'use strict';

// ===========================================
// State
// ===========================================

let modelInfo = {};
let transcriberStatus = {};
let currentHistory = [];
let currentDictionary = null;
let currentMacros = null;
let capturedHotkeyString = '';
let isNotesRecording = false;

// ===========================================
// Initialization
// ===========================================

window.electronAPI.models.getInfo();

// Listen for model info updates
window.electronAPI.models.onInfo((info) => {
  modelInfo = info;
  renderModels();
  updateStatus();
});

window.electronAPI.models.onStatus((status) => {
  transcriberStatus = status;
  updateStatus();
});

window.electronAPI.models.onDownloadProgress((data) => {
  const progressBar = document.getElementById(`progress-${data.model}`);
  const progressFill = document.getElementById(`progress-fill-${data.model}`);
  const downloadBtn = document.getElementById(`btn-download-${data.model}`);

  if (progressBar && progressFill) {
    progressBar.style.display = 'block';
    progressFill.style.width = data.progress + '%';

    if (downloadBtn) {
      if (data.stage === 'verifying') {
        downloadBtn.textContent = `Verifying... ${data.progress}%`;
      } else {
        downloadBtn.textContent = `Downloading... ${data.progress}%`;
      }
      downloadBtn.disabled = true;
    }
  }
});

window.electronAPI.models.onDownloadComplete((modelName) => {
  console.log('Download complete:', modelName);
  window.electronAPI.models.getInfo(); // Refresh model info
});

window.electronAPI.models.onDownloadError((data) => {
  alert(`Failed to download ${data.model}: ${data.error}`);
  window.electronAPI.models.getInfo(); // Refresh to reset UI
});

function renderModels() {
  const modelList = document.getElementById('model-list');
  modelList.innerHTML = '';

  for (const [name, model] of Object.entries(modelInfo)) {
    const isActive = transcriberStatus.currentModel === name;
    const modelDiv = document.createElement('div');
    modelDiv.className = `model-item ${model.downloaded ? 'downloaded' : ''} ${isActive ? 'active' : ''}`;
    
    modelDiv.innerHTML = `
      <div class="model-header">
        <div>
          <span class="model-name">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
          ${model.downloaded ? '<span class="badge badge-success">Downloaded</span>' : ''}
          ${isActive ? '<span class="badge badge-info">Active</span>' : ''}
        </div>
        <div class="model-size">${model.size}</div>
      </div>
      <div class="model-description">${model.description}</div>
      <div class="model-actions">
        ${!model.downloaded ? 
          `<button class="btn-download" id="btn-download-${name}" onclick="downloadModel('${name}')">Download</button>` :
          `<button class="btn-use" id="btn-use-${name}" onclick="selectModel('${name}')" ${isActive ? 'disabled' : ''}>
            ${isActive ? 'In Use' : 'Use This'}
          </button>`
        }
      </div>
      <div class="progress-bar" id="progress-${name}">
        <div class="progress-fill" id="progress-fill-${name}"></div>
      </div>
    `;
    
    modelList.appendChild(modelDiv);
  }
}

function updateStatus() {
  const modelStatus = document.getElementById('model-status');
  const appStatus = document.getElementById('app-status');
  
  if (transcriberStatus.initialized) {
    modelStatus.textContent = `Model: ${transcriberStatus.currentModel}`;
    appStatus.textContent = 'Ready to Transcribe';
  } else {
    modelStatus.textContent = 'Model: None';
    appStatus.textContent = 'Download a model';
  }
}

function downloadModel(modelName) {
  console.log('Downloading model:', modelName);
  window.electronAPI.models.download(modelName);
}

function selectModel(modelName) {
  console.log('Selecting model:', modelName);
  window.electronAPI.models.select(modelName);
}

// Hotkey Configuration
const modal = document.getElementById('hotkey-modal');
const changeHotkeyBtn = document.getElementById('change-hotkey-btn');
const cancelHotkeyBtn = document.getElementById('cancel-hotkey-btn');
const saveHotkeyBtn = document.getElementById('save-hotkey-btn');
const capturedHotkeyDisplay = document.getElementById('captured-hotkey');
const hotkeyError = document.getElementById('hotkey-error');
const currentHotkeyDisplay = document.getElementById('current-hotkey');
const settingsHotkeyDisplay = document.getElementById('settings-hotkey');
const toggleModeCheckbox = document.getElementById('toggle-mode-checkbox');
const toggleModeLabel = document.getElementById('toggle-mode-label');
const historyEnabledCheckbox = document.getElementById('history-enabled-checkbox');
const historyEnabledLabel = document.getElementById('history-enabled-label');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    // Update button states
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update content visibility
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Load data when switching tabs
    if (tabName === 'history') {
      window.electronAPI.history.get();
    } else if (tabName === 'dictionary') {
      window.electronAPI.dictionary.get();
      window.electronAPI.macros.get();
    }
  });
});

// Load current config on startup
window.electronAPI.config.get();

window.electronAPI.config.onLoaded((config) => {
  const hotkey = config.hotkey.displayString;
  currentHotkeyDisplay.textContent = hotkey;
  settingsHotkeyDisplay.textContent = hotkey;

  // Set toggle mode
  const toggleMode = config.toggleMode || false;
  toggleModeCheckbox.checked = toggleMode;
  toggleModeLabel.textContent = toggleMode ? 'Toggle Mode' : 'Hold to Record';

  // Set history enabled
  const historyEnabled = config.historyEnabled !== false;
  historyEnabledCheckbox.checked = historyEnabled;
  historyEnabledLabel.textContent = historyEnabled ? 'Enabled' : 'Disabled';

  // Set language
  const currentLanguage = config.language || 'en';
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    languageSelect.value = currentLanguage;
  }
});

// Language management
const languageSelect = document.getElementById('language-select');

// Load supported languages on startup
window.electronAPI.language.getSupportedLanguages();
window.electronAPI.language.getCurrent();

// Populate language dropdown
window.electronAPI.language.onSupportedLanguages((languages) => {
  languageSelect.innerHTML = languages.map(lang =>
    `<option value="${lang.code}" style="background: white; color: #333;">${lang.name}</option>`
  ).join('');

  // Request current language to set the selected option
  window.electronAPI.language.getCurrent();
});

// Set current language when loaded
window.electronAPI.language.onCurrent((languageCode) => {
  languageSelect.value = languageCode;
});

// Handle language change
languageSelect.addEventListener('change', (e) => {
  const selectedLanguage = e.target.value;
  window.electronAPI.language.set(selectedLanguage);
  console.log('Language changed to:', selectedLanguage);
});

// Listen for language updates
window.electronAPI.language.onUpdated((languageCode) => {
  languageSelect.value = languageCode;
  console.log('Language updated to:', languageCode);
});

window.electronAPI.language.onError((error) => {
  console.error('Language error:', error);
  alert('Failed to change language: ' + error);
});

// Macro management
const macroNameInput = document.getElementById('macro-name-input');
const macroTextInput = document.getElementById('macro-text-input');
const saveMacroBtn = document.getElementById('save-macro-btn');
const macrosList = document.getElementById('macros-list');

// Load macros on startup
window.electronAPI.macros.get();

// Listen for macros data
window.electronAPI.macros.onData((macros) => {
  currentMacros = macros;
  renderMacros();
});

window.electronAPI.macros.onUpdated((macros) => {
  currentMacros = macros;
  renderMacros();
});

window.electronAPI.macros.onError((error) => {
  console.error('Macros error:', error);
  alert('Macros error: ' + error);
});

// Render macros list
function renderMacros() {
  if (!currentMacros || currentMacros.macros.length === 0) {
    macrosList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.7;">No macros yet. Create one above!</div>';
    return;
  }

  macrosList.innerHTML = currentMacros.macros.map(macro => {
    const preview = macro.text.length > 50 ? macro.text.substring(0, 50) + '...' : macro.text;
    const displayText = preview.replace(/\n/g, '↵');

    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.2); border-radius: 5px;">
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 4px;">insert ${macro.name}</div>
          <div style="font-size: 12px; opacity: 0.7;">${displayText}</div>
        </div>
        <button
          onclick="editMacro('${macro.name.replace(/'/g, "\\'")}', \`${macro.text.replace(/`/g, '\\`')}\`)"
          style="padding: 6px 12px; background: rgba(255,255,255,0.2); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;"
        >
          Edit
        </button>
        <button
          onclick="deleteMacro('${macro.name.replace(/'/g, "\\'")}')"
          style="padding: 6px 12px; background: rgba(255,0,0,0.3); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;"
        >
          Delete
        </button>
      </div>
    `;
  }).join('');
}

// Save macro
saveMacroBtn.addEventListener('click', () => {
  const name = macroNameInput.value.trim();
  const text = macroTextInput.value; // Don't trim - allow whitespace-only macros like newlines

  if (!name) {
    alert('Please enter a macro name');
    return;
  }

  if (text.length === 0) {
    alert('Please enter macro text');
    return;
  }

  window.electronAPI.macros.add(name, text);
  macroNameInput.value = '';
  macroTextInput.value = '';
});

// Edit macro (called from rendered HTML)
window.editMacro = function(name, text) {
  macroNameInput.value = name;
  macroTextInput.value = text;
  macroNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Delete macro (called from rendered HTML)
window.deleteMacro = function(name) {
  window.electronAPI.macros.delete(name);
};

// Open modal
changeHotkeyBtn.addEventListener('click', () => {
  modal.classList.remove('hidden');
  capturedHotkeyString = '';
  capturedHotkeyDisplay.textContent = 'Waiting...';
  hotkeyError.classList.add('hidden');
  saveHotkeyBtn.disabled = true;

  // Add event listeners for key capture
  document.addEventListener('keydown', captureKeyDown);
  document.addEventListener('keyup', captureKeyUp);
});

// Cancel modal
cancelHotkeyBtn.addEventListener('click', closeModal);

// Close modal on Escape key
function handleEscapeKey(e) {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
}

function closeModal() {
  modal.classList.add('hidden');
  document.removeEventListener('keydown', captureKeyDown);
  document.removeEventListener('keyup', captureKeyUp);
  capturedHotkeyString = '';
}

// Capture key combination
function captureKeyDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const key = e.key;
  const modifiers = [];

  // Collect modifiers
  if (e.ctrlKey) modifiers.push('Ctrl');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.altKey) modifiers.push('Alt');
  if (e.metaKey) modifiers.push('Meta');

  // Build hotkey string
  let hotkeyParts = [...modifiers];

  // Add non-modifier key if pressed
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    // Normalize the key name
    let normalizedKey = key;

    if (key === ' ') {
      normalizedKey = 'Space';
    } else if (key.length === 1) {
      normalizedKey = key.toUpperCase();
    } else if (key.startsWith('F') && key.length <= 3) {
      // Function keys F1-F12
      normalizedKey = key.toUpperCase();
    } else {
      // Other special keys (Enter, Escape, etc.)
      normalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
    }

    hotkeyParts.push(normalizedKey);
  }

  // Only update if we have a complete combination
  if (hotkeyParts.length > 0) {
    capturedHotkeyString = hotkeyParts.join('+');
    capturedHotkeyDisplay.textContent = capturedHotkeyString;

    // Validate
    window.electronAPI.hotkey.validate(capturedHotkeyString).then(result => {
      if (result.valid) {
        hotkeyError.classList.add('hidden');
        saveHotkeyBtn.disabled = false;
      } else {
        hotkeyError.textContent = result.error;
        hotkeyError.classList.remove('hidden');
        saveHotkeyBtn.disabled = true;
      }
    });
  }
}

function captureKeyUp(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Save hotkey
saveHotkeyBtn.addEventListener('click', () => {
  if (capturedHotkeyString) {
    window.electronAPI.hotkey.save(capturedHotkeyString);
  }
});

// Handle hotkey save response
window.electronAPI.hotkey.onSaved((hotkey) => {
  currentHotkeyDisplay.textContent = hotkey;
  settingsHotkeyDisplay.textContent = hotkey;
  closeModal();
});

window.electronAPI.hotkey.onError((error) => {
  hotkeyError.textContent = error;
  hotkeyError.classList.remove('hidden');
  saveHotkeyBtn.disabled = true;
});

// Listen for hotkey updates from other sources
window.electronAPI.hotkey.onUpdated((hotkey) => {
  currentHotkeyDisplay.textContent = hotkey;
  settingsHotkeyDisplay.textContent = hotkey;
});

// Toggle mode event listener
toggleModeCheckbox.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  window.electronAPI.toggleMode.set(enabled);
  toggleModeLabel.textContent = enabled ? 'Toggle Mode' : 'Hold to Record';
});

// Listen for toggle mode updates
window.electronAPI.toggleMode.onUpdated((enabled) => {
  toggleModeCheckbox.checked = enabled;
  toggleModeLabel.textContent = enabled ? 'Toggle Mode' : 'Hold to Record';
});

window.electronAPI.toggleMode.onChanged((enabled) => {
  toggleModeCheckbox.checked = enabled;
  toggleModeLabel.textContent = enabled ? 'Toggle Mode' : 'Hold to Record';
});

window.electronAPI.toggleMode.onError((error) => {
  console.error('Toggle mode error:', error);
  // Revert checkbox on error
  toggleModeCheckbox.checked = !toggleModeCheckbox.checked;
});

// History enabled toggle
historyEnabledCheckbox.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  window.electronAPI.history.setEnabled(enabled);
  historyEnabledLabel.textContent = enabled ? 'Enabled' : 'Disabled';
});

window.electronAPI.history.onEnabledUpdated((enabled) => {
  historyEnabledCheckbox.checked = enabled;
  historyEnabledLabel.textContent = enabled ? 'Enabled' : 'Disabled';
});

// History management
const historyList = document.getElementById('history-list');
const historySearchInput = document.getElementById('history-search-input');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Load history
window.electronAPI.history.onData((history) => {
  currentHistory = history;
  renderHistory(history);
});

window.electronAPI.history.onUpdated((history) => {
  currentHistory = history;
  renderHistory(history);
});

// Render history list
function renderHistory(history, filter = '') {
  if (!history || history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">No transcriptions yet</div>';
    return;
  }

  const filtered = filter
    ? history.filter(entry => entry.text.toLowerCase().includes(filter.toLowerCase()))
    : history;

  if (filtered.length === 0) {
    historyList.innerHTML = '<div class="empty-state">No matching transcriptions</div>';
    return;
  }

  historyList.innerHTML = filtered.map(entry => {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleString();
    const preview = entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : '');

    return `
      <div class="history-item"
           data-id="${entry.id}"
           data-text="${entry.text.replace(/"/g, '&quot;')}"
           title="${entry.text}">
        <div class="history-item-header">
          <span class="history-item-time">${timeStr}</span>
          <span class="history-item-meta">${entry.model} | ${entry.language}</span>
        </div>
        <div class="history-item-text">${preview}</div>
        <button class="history-item-delete" data-id="${entry.id}">Delete</button>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('history-item-delete')) {
        const text = item.dataset.text;
        window.electronAPI.history.copyFrom(text);
      }
    });
  });

  // Add delete handlers
  document.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      window.electronAPI.history.delete(id);
    });
  });
}

// Search
historySearchInput.addEventListener('input', (e) => {
  renderHistory(currentHistory, e.target.value);
});

// Clear all
clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear all transcription history? This cannot be undone.')) {
    window.electronAPI.history.clear();
  }
});

// Dictionary management
const hearInput = document.getElementById('hear-input');
const replaceInput = document.getElementById('replace-input');
const addWordBtn = document.getElementById('add-word-btn');
const customWordsList = document.getElementById('custom-words-list');
const enablePronounsCheckbox = document.getElementById('enable-pronouns');
const pronounLabel = document.getElementById('pronoun-label');
const userNameInput = document.getElementById('user-name');
const pronounPreview = document.getElementById('pronoun-preview');

// Load dictionary on startup
window.electronAPI.dictionary.get();

// Listen for dictionary updates
window.electronAPI.dictionary.onData((dictionary) => {
  currentDictionary = dictionary;
  renderCustomWords();
  updatePronounUI();
});

window.electronAPI.dictionary.onUpdated((dictionary) => {
  currentDictionary = dictionary;
  renderCustomWords();
  updatePronounUI();
});

window.electronAPI.dictionary.onError((error) => {
  console.error('Dictionary error:', error);
  alert('Dictionary error: ' + error);
});

// Render custom words list
function renderCustomWords() {
  if (!currentDictionary || !currentDictionary.customWords) {
    customWordsList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.7;">No custom words yet</div>';
    return;
  }

  if (currentDictionary.customWords.length === 0) {
    customWordsList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.7;">No custom words yet</div>';
    return;
  }

  customWordsList.innerHTML = currentDictionary.customWords.map(word => `
    <div class="word-item" style="display: flex; align-items: center; gap: 10px; padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.2); border-radius: 5px;">
      <input
        type="text"
        value="${word.hear}"
        data-original-hear="${word.hear}"
        readonly
        style="flex: 1; font-weight: 500; background: transparent; border: 1px solid transparent; color: white; padding: 6px; border-radius: 3px;"
      />
      <span style="opacity: 0.7;">→</span>
      <input
        type="text"
        value="${word.replace.replace(/"/g, '&quot;')}"
        onchange="updateCustomWord('${word.hear.replace(/'/g, "\\'")}', this.value)"
        style="flex: 1; color: #a0d9ff; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); padding: 6px; border-radius: 3px;"
      />
      <button
        onclick="removeCustomWord('${word.hear.replace(/'/g, "\\'")}')"
        style="padding: 6px 12px; background: rgba(255,0,0,0.3); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;"
      >
        Delete
      </button>
    </div>
  `).join('');
}

// Add custom word
addWordBtn.addEventListener('click', () => {
  const hear = hearInput.value.trim();
  const replace = replaceInput.value.trim();

  if (!hear || !replace) {
    alert('Please enter both "when I say" and "replace with" values');
    return;
  }

  window.electronAPI.dictionary.addWord(hear, replace);
  hearInput.value = '';
  replaceInput.value = '';
});

// Allow Enter key to add word
hearInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    replaceInput.focus();
  }
});

replaceInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addWordBtn.click();
  }
});

// Remove custom word (called from rendered HTML)
window.removeCustomWord = function(hear) {
  window.electronAPI.dictionary.removeWord(hear);
};

// Update custom word replacement (called from rendered HTML)
window.updateCustomWord = function(hear, newReplace) {
  if (!newReplace || newReplace.trim().length === 0) {
    return;
  }
  // Just add the word with the new replacement (will update if exists)
  window.electronAPI.dictionary.addWord(hear, newReplace.trim());
};

// Toggle pronoun replacement
enablePronounsCheckbox.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  window.electronAPI.dictionary.enablePronouns(enabled);
});

// Update name
userNameInput.addEventListener('input', (e) => {
  const name = e.target.value.trim();
  window.electronAPI.dictionary.setName(name);
  updatePreview(name);
});

// Update pronoun UI
function updatePronounUI() {
  if (!currentDictionary || !currentDictionary.pronounReplacements) {
    return;
  }

  const enabled = currentDictionary.pronounReplacements.enabled;
  const name = currentDictionary.pronounReplacements.name;

  enablePronounsCheckbox.checked = enabled;
  userNameInput.value = name;
  pronounLabel.textContent = enabled ? 'Pronoun replacement enabled' : 'Enable pronoun replacement';

  updatePreview(name);
}

// Update preview text
function updatePreview(name) {
  if (!name || name.length === 0) {
    pronounPreview.textContent = '"I think my solution works" → (enter your name to see preview)';
    pronounPreview.style.opacity = '0.6';
  } else {
    pronounPreview.textContent = `"I think my solution works" → "${name} thinks ${name}'s solution works"`;
    pronounPreview.style.opacity = '1';
  }
}

// ===========================================
// Notes Tab
// ===========================================

const notesRecordBtn = document.getElementById('notes-record-btn');
const notesRecordText = document.getElementById('notes-record-text');
const notesStatus = document.getElementById('notes-status');
const notesTextarea = document.getElementById('notes-textarea');
const notesCopyBtn = document.getElementById('notes-copy-btn');
const notesClearBtn = document.getElementById('notes-clear-btn');

// Record button
notesRecordBtn.addEventListener('click', () => {
  if (!isNotesRecording) {
    // Start recording
    window.electronAPI.recording.startNotes();
    isNotesRecording = true;
    notesRecordBtn.style.background = 'rgba(34, 197, 94, 0.8)'; // Green
    notesRecordText.textContent = 'Stop Recording';
    notesStatus.textContent = 'Recording...';
  } else {
    // Stop recording
    window.electronAPI.recording.stopNotes();
    isNotesRecording = false;
    notesRecordBtn.style.background = 'rgba(220, 38, 38, 0.8)'; // Red
    notesRecordText.textContent = 'Start Recording';
    notesStatus.textContent = 'Processing...';
  }
});

// Listen for transcription results
window.electronAPI.recording.onNotesComplete((text) => {
  // Append transcribed text to textarea
  const currentText = notesTextarea.value;
  const newText = currentText ? currentText + '\n' + text : text;
  notesTextarea.value = newText;
  notesStatus.textContent = 'Transcription complete!';

  // Clear status after 3 seconds
  setTimeout(() => {
    notesStatus.textContent = '';
  }, 3000);
});

// Listen for recording errors
window.electronAPI.recording.onNotesError((error) => {
  notesStatus.textContent = `Error: ${error}`;
  isNotesRecording = false;
  notesRecordBtn.style.background = 'rgba(220, 38, 38, 0.8)';
  notesRecordText.textContent = 'Start Recording';
});

// Copy to clipboard
notesCopyBtn.addEventListener('click', () => {
  const text = notesTextarea.value;
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = notesCopyBtn.textContent;
      notesCopyBtn.textContent = 'Copied!';
      setTimeout(() => {
        notesCopyBtn.textContent = originalText;
      }, 2000);
    });
  }
});

// Clear textarea
notesClearBtn.addEventListener('click', () => {
  if (confirm('Clear all notes?')) {
    notesTextarea.value = '';
  }
});

// ===========================================
// Audio Capture for Notes Recording
// ===========================================

let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

window.electronAPI.audioCapture.onStart(async () => {
  try {
    // Get microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    audioChunks = [];

    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(100); // Collect data every 100ms
    console.log('Notes audio capture started');

  } catch (err) {
    console.error('Failed to start notes audio capture:', err);
    notesStatus.textContent = `Microphone error: ${err.message}`;
    isNotesRecording = false;
    notesRecordBtn.style.background = 'rgba(220, 38, 38, 0.8)';
    notesRecordText.textContent = 'Start Recording';
  }
});

window.electronAPI.audioCapture.onStop(async (outputPath) => {
  try {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.error('MediaRecorder not active');
      return;
    }

    mediaRecorder.onstop = async () => {
      // Create blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });

      // Convert to WAV format
      const wavBuffer = await convertToWav(audioBlob);

      // Send back to main process
      window.electronAPI.audioCapture.sendComplete(wavBuffer);

      // Stop all tracks
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }

      console.log('Notes audio capture completed');
    };

    mediaRecorder.stop();

  } catch (err) {
    console.error('Failed to stop notes audio capture:', err);
    notesStatus.textContent = `Error: ${err.message}`;
  }
});

// Convert WebM/Opus to WAV format
async function convertToWav(audioBlob) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;

        // Decode audio data
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to WAV
        const wavBuffer = audioBufferToWav(audioBuffer);
        resolve(wavBuffer);

      } catch (err) {
        reject(err);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(audioBlob);
  });
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(audioBuffer) {
  const numberOfChannels = 1; // Mono
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const channelData = audioBuffer.getChannelData(0); // Get first channel
  const samples = new Int16Array(channelData.length);

  // Convert float32 to int16
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Create WAV file
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bitDepth / 8, true);
  view.setUint16(32, numberOfChannels * bitDepth / 8, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write audio data
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }

  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
