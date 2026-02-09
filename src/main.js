'use strict';

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Resource path utilities
const { getBinPath, getModelsPath } = require('./resource-path');

// Manager imports
const TrayManager = require('./tray');
const HotkeyManager = require('./hotkeys');
const { validateHotkey, parseHotkey } = require('./hotkeys');
const AudioRecorder = require('./recorder');
const ModelManager = require('./model-manager');
const Transcriber = require('./transcriber');
const ClipboardManager = require('./clipboard');
const ConfigManager = require('./config-manager');
const HistoryManager = require('./history-manager');
const DictionaryManager = require('./dictionary-manager');
const MacroManager = require('./macro-manager');

// Disable GPU acceleration for WSL compatibility
app.disableHardwareAcceleration();

// Application state
let mainWindow = null;
let recordingPopup = null;
let trayManager = null;
let hotkeyManager = null;
let audioRecorder = null;
let modelManager = null;
let transcriber = null;
let clipboardManager = null;
let configManager = null;
let historyManager = null;
let dictionaryManager = null;
let macroManager = null;

/**
 * Gets the appropriate icon path based on platform
 * @returns {string} Path to the icon file
 */
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'logo.ico' : 'logo.png';
  return path.join(__dirname, '../public/assets', iconName);
}

/**
 * Ensures required directories exist on first run
 * Creates bin/ and models/ directories if they don't exist
 */
function ensureRequiredDirectories() {
  const directories = [getBinPath(), getModelsPath()];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('Created directory:', dir);
    }
  }
}

/**
 * Creates the main application window
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-main.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

/**
 * Creates the floating recording popup window
 */
function createRecordingPopup() {
  recordingPopup = new BrowserWindow({
    width: 160,
    height: 35,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-recording.js')
    }
  });

  recordingPopup.loadFile(path.join(__dirname, '../public/recording-popup.html'));
}

// Initialize app
app.whenReady().then(async () => {
  // Ensure required directories exist before anything else
  ensureRequiredDirectories();

  createMainWindow();
  createRecordingPopup();

  // Initialize managers
  configManager = new ConfigManager();
  historyManager = new HistoryManager();
  dictionaryManager = new DictionaryManager();
  macroManager = new MacroManager();
  trayManager = new TrayManager(mainWindow);
  audioRecorder = new AudioRecorder();
  modelManager = new ModelManager();
  transcriber = new Transcriber(modelManager);
  clipboardManager = new ClipboardManager();

  // Initialize hotkey manager with saved hotkey and toggle mode
  const savedHotkey = configManager.get('hotkey');
  const toggleMode = configManager.get('toggleMode');
  hotkeyManager = new HotkeyManager(
    savedHotkey.displayString,
    () => startRecording(),
    () => stopRecording(),
    toggleMode
  );

  // Check if any model is downloaded
  if (modelManager.hasAnyModel()) {
    const models = modelManager.getDownloadedModels();
    await transcriber.initialize(models[0]); // Use first available model
    console.log('Transcriber initialized with model:', models[0]);
  } else {
    console.log('No models found. User needs to download one.');
  }

  // Set language from config
  const savedLanguage = configManager.get('language') || 'en';
  transcriber.setLanguage(savedLanguage);
  console.log('Language set to:', savedLanguage);

  // Send model info to main window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('model-info', modelManager.getModelInfo());
    mainWindow.webContents.send('transcriber-status', transcriber.getStatus());
  });
});

/**
 * Starts the recording process and shows the popup
 */
function startRecording() {
  console.log('Recording started');

  recordingPopup.show();
  positionRecordingPopup();

  trayManager.setRecording(true);
  audioRecorder.start(recordingPopup);

  const toggleMode = configManager.get('toggleMode');
  recordingPopup.webContents.send('recording-started', { toggleMode });
}

/**
 * Positions the recording popup at the bottom center of the screen
 */
function positionRecordingPopup() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { width: popupWidth, height: popupHeight } = recordingPopup.getBounds();

  const x = Math.floor((screenWidth - popupWidth) / 2);
  const y = screenHeight - popupHeight - 50;

  recordingPopup.setPosition(x, y);
}

/**
 * Stops the recording and processes the transcription
 */
async function stopRecording() {
  console.log('Recording stopped');

  trayManager.setRecording(false);
  recordingPopup.webContents.send('recording-stopped');

  // Allow stop sound to play
  await sleep(100);

  try {
    const audioFilePath = await audioRecorder.stop();
    console.log('Audio saved to:', audioFilePath);

    recordingPopup.webContents.send('transcribing');

    if (!transcriber.isInitialized) {
      throw new Error('No model loaded. Please download a model first.');
    }

    const text = await transcriber.transcribe(audioFilePath);

    if (!text || text.length === 0) {
      throw new Error('No speech detected');
    }

    console.log('Transcription:', text);

    const finalText = processTranscription(text);
    saveToHistory(text);
    hideRecordingPopup();

    await clipboardManager.copyAndPaste(finalText);
    console.log('Transcription complete:', finalText);

    audioRecorder.cleanup();
  } catch (error) {
    console.error('Transcription failed:', error.message);
    hideRecordingPopup();
  }
}

/**
 * Applies macros and dictionary replacements to transcribed text
 * @param {string} text - Raw transcription
 * @returns {string} Processed text
 */
function processTranscription(text) {
  let processedText = macroManager.expandMacros(text);
  if (processedText !== text) {
    console.log('After macro expansion:', processedText);
  }

  const finalText = dictionaryManager.applyReplacements(processedText);
  if (finalText !== processedText) {
    console.log('After dictionary:', finalText);
  }

  return finalText;
}

/**
 * Saves transcription to history if enabled
 * @param {string} text - Original transcription text
 */
function saveToHistory(text) {
  const historyEnabled = configManager.get('historyEnabled');
  if (!historyEnabled || !historyManager) {
    return;
  }

  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    text,
    model: transcriber.currentModel || 'unknown',
    language: transcriber.currentLanguage || 'en'
  };

  historyManager.add(entry);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history-updated', historyManager.getRecent(50));
  }
}

/**
 * Hides the recording popup
 */
function hideRecordingPopup() {
  recordingPopup.webContents.send('transcription-complete');
  recordingPopup.hide();
}

/**
 * Promise-based sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// IPC handlers for main window
ipcMain.on('download-model', async (event, modelName) => {
  try {
    console.log('Downloading model:', modelName);
    
    await modelManager.downloadModel(modelName, (progress) => {
      event.reply('download-progress', {
        model: modelName,
        ...progress
      });
    });

    event.reply('download-complete', modelName);
    event.reply('model-info', modelManager.getModelInfo());

    // Auto-initialize if this is the first model
    if (!transcriber.isInitialized) {
      await transcriber.initialize(modelName);
      event.reply('transcriber-status', transcriber.getStatus());
    }

  } catch (error) {
    console.error('Download failed:', error);
    event.reply('download-error', { model: modelName, error: error.message });
  }
});

ipcMain.on('select-model', async (event, modelName) => {
  try {
    await transcriber.initialize(modelName);
    event.reply('transcriber-status', transcriber.getStatus());
    console.log('Switched to model:', modelName);
  } catch (error) {
    console.error('Failed to switch model:', error);
    event.reply('model-error', error.message);
  }
});

ipcMain.on('get-model-info', (event) => {
  event.reply('model-info', modelManager.getModelInfo());
  event.reply('transcriber-status', transcriber.getStatus());
});

// Configuration IPC handlers
ipcMain.on('get-config', (event) => {
  event.reply('config-loaded', configManager.getAll());
});

ipcMain.handle('validate-hotkey', async (event, hotkeyString) => {
  return validateHotkey(hotkeyString);
});

ipcMain.on('save-hotkey', (event, hotkeyString) => {
  try {
    const validation = validateHotkey(hotkeyString);
    if (!validation.valid) {
      event.reply('hotkey-error', validation.error);
      return;
    }

    const parsed = parseHotkey(hotkeyString);
    configManager.set('hotkey', {
      displayString: parsed.displayString,
      keycodes: parsed.keycodes
    });

    hotkeyManager.updateShortcut(parsed.displayString);
    event.reply('hotkey-saved', parsed.displayString);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hotkey-updated', parsed.displayString);
    }

    console.log('Hotkey updated to:', parsed.displayString);
  } catch (error) {
    console.error('Error saving hotkey:', error);
    event.reply('hotkey-error', 'Failed to save hotkey: ' + error.message);
  }
});

// Toggle mode IPC handler
ipcMain.on('set-toggle-mode', (event, enabled) => {
  try {
    // Save to config
    configManager.set('toggleMode', enabled);

    // Update hotkey manager
    hotkeyManager.setToggleMode(enabled);

    // Notify renderer
    event.reply('toggle-mode-updated', enabled);

    // Broadcast to all windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-mode-changed', enabled);
    }

    console.log('Toggle mode updated to:', enabled);
  } catch (error) {
    console.error('Error setting toggle mode:', error);
    event.reply('toggle-mode-error', error.message);
  }
});

// History IPC handlers
ipcMain.on('get-history', (event) => {
  event.reply('history-data', historyManager.getRecent(50));
});

ipcMain.on('delete-history-entry', (event, id) => {
  historyManager.delete(id);
  event.reply('history-updated', historyManager.getRecent(50));
});

ipcMain.on('clear-history', (event) => {
  historyManager.clear();
  event.reply('history-updated', historyManager.getRecent(50));
});

ipcMain.on('copy-from-history', async (event, text) => {
  try {
    await clipboardManager.copyAndPaste(text);
  } catch (error) {
    console.error('Failed to copy from history:', error);
  }
});

// History enabled toggle
ipcMain.on('set-history-enabled', (event, enabled) => {
  configManager.set('historyEnabled', enabled);
  event.reply('history-enabled-updated', enabled);
});

// Dictionary IPC handlers
ipcMain.on('get-dictionary', (event) => {
  event.reply('dictionary-data', dictionaryManager.getDictionary());
});

ipcMain.on('add-custom-word', (event, hear, replace) => {
  try {
    dictionaryManager.addCustomWord(hear, replace);
    event.reply('dictionary-updated', dictionaryManager.getDictionary());
    console.log(`Added custom word: "${hear}" → "${replace}"`);
  } catch (error) {
    console.error('Failed to add custom word:', error);
    event.reply('dictionary-error', error.message);
  }
});

ipcMain.on('remove-custom-word', (event, hear) => {
  try {
    dictionaryManager.removeCustomWord(hear);
    event.reply('dictionary-updated', dictionaryManager.getDictionary());
    console.log(`Removed custom word: "${hear}"`);
  } catch (error) {
    console.error('Failed to remove custom word:', error);
    event.reply('dictionary-error', error.message);
  }
});

ipcMain.on('set-name', (event, name) => {
  try {
    dictionaryManager.setName(name);
    event.reply('dictionary-updated', dictionaryManager.getDictionary());
    console.log(`Set name for pronoun replacement: "${name}"`);
  } catch (error) {
    console.error('Failed to set name:', error);
    event.reply('dictionary-error', error.message);
  }
});

ipcMain.on('enable-pronoun-replacement', (event, enabled) => {
  try {
    dictionaryManager.enablePronounReplacement(enabled);
    event.reply('dictionary-updated', dictionaryManager.getDictionary());
    console.log(`Pronoun replacement ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to toggle pronoun replacement:', error);
    event.reply('dictionary-error', error.message);
  }
});

// Language IPC handlers
ipcMain.on('get-supported-languages', (event) => {
  event.reply('supported-languages', configManager.getSupportedLanguages());
});

ipcMain.on('get-current-language', (event) => {
  const currentLanguage = configManager.get('language') || 'en';
  event.reply('current-language', currentLanguage);
});

ipcMain.on('set-language', (event, languageCode) => {
  try {
    configManager.set('language', languageCode);
    transcriber.setLanguage(languageCode);
    event.reply('language-updated', languageCode);
    console.log(`Language changed to: ${languageCode}`);
  } catch (error) {
    console.error('Failed to set language:', error);
    event.reply('language-error', error.message);
  }
});

// Macro IPC handlers
ipcMain.on('get-macros', (event) => {
  event.reply('macros-data', macroManager.getMacros());
});

ipcMain.on('add-macro', (event, name, text) => {
  try {
    macroManager.addMacro(name, text);
    event.reply('macros-updated', macroManager.getMacros());
    console.log(`Added/updated macro: "${name}"`);
  } catch (error) {
    console.error('Failed to add macro:', error);
    event.reply('macros-error', error.message);
  }
});

ipcMain.on('delete-macro', (event, name) => {
  try {
    macroManager.deleteMacro(name);
    event.reply('macros-updated', macroManager.getMacros());
    console.log(`Deleted macro: "${name}"`);
  } catch (error) {
    console.error('Failed to delete macro:', error);
    event.reply('macros-error', error.message);
  }
});

// Notes recording IPC handlers (in-app recording without global hotkeys)
ipcMain.on('start-notes-recording', (event) => {
  try {
    console.log('Notes recording started');
    audioRecorder.start(mainWindow);
  } catch (error) {
    console.error('Failed to start notes recording:', error);
    event.reply('notes-recording-error', error.message);
  }
});

ipcMain.on('stop-notes-recording', async (event) => {
  try {
    console.log('Notes recording stopped');

    const audioFilePath = await audioRecorder.stop();
    console.log('Notes audio saved to:', audioFilePath);

    if (!transcriber.isInitialized) {
      throw new Error('No model loaded. Please download a model first.');
    }

    const text = await transcriber.transcribe(audioFilePath);
    if (!text || text.length === 0) {
      throw new Error('No speech detected');
    }

    console.log('Notes transcription:', text);

    const finalText = processTranscription(text);
    saveToHistory(text);

    event.reply('notes-recording-complete', finalText);
    console.log('Notes transcription complete:', finalText);

    audioRecorder.cleanup();
  } catch (error) {
    console.error('Notes transcription failed:', error.message);
    event.reply('notes-recording-error', error.message);
  }
});

// Quit app properly
app.on('before-quit', () => {
  app.isQuitting = true;
  if (hotkeyManager) hotkeyManager.unregister();
  if (audioRecorder) audioRecorder.cleanup();
});

app.on('window-all-closed', () => {
  // Don't quit, keep running in tray
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
