'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for the main window.
 * Exposes safe IPC APIs to the renderer via contextBridge.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Model management
  models: {
    getInfo: () => ipcRenderer.send('get-model-info'),
    download: (modelName) => ipcRenderer.send('download-model', modelName),
    select: (modelName) => ipcRenderer.send('select-model', modelName),
    onInfo: (callback) => ipcRenderer.on('model-info', (_, info) => callback(info)),
    onStatus: (callback) => ipcRenderer.on('transcriber-status', (_, status) => callback(status)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (_, model) => callback(model)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (_, data) => callback(data))
  },

  // Configuration management
  config: {
    get: () => ipcRenderer.send('get-config'),
    onLoaded: (callback) => ipcRenderer.on('config-loaded', (_, config) => callback(config))
  },

  // Hotkey management
  hotkey: {
    validate: (hotkeyString) => ipcRenderer.invoke('validate-hotkey', hotkeyString),
    save: (hotkeyString) => ipcRenderer.send('save-hotkey', hotkeyString),
    onSaved: (callback) => ipcRenderer.on('hotkey-saved', (_, hotkey) => callback(hotkey)),
    onError: (callback) => ipcRenderer.on('hotkey-error', (_, error) => callback(error)),
    onUpdated: (callback) => ipcRenderer.on('hotkey-updated', (_, hotkey) => callback(hotkey))
  },

  // Toggle mode management
  toggleMode: {
    set: (enabled) => ipcRenderer.send('set-toggle-mode', enabled),
    onUpdated: (callback) => ipcRenderer.on('toggle-mode-updated', (_, enabled) => callback(enabled)),
    onChanged: (callback) => ipcRenderer.on('toggle-mode-changed', (_, enabled) => callback(enabled)),
    onError: (callback) => ipcRenderer.on('toggle-mode-error', (_, error) => callback(error))
  },

  // History management
  history: {
    get: () => ipcRenderer.send('get-history'),
    delete: (id) => ipcRenderer.send('delete-history-entry', id),
    clear: () => ipcRenderer.send('clear-history'),
    copyFrom: (text) => ipcRenderer.send('copy-from-history', text),
    setEnabled: (enabled) => ipcRenderer.send('set-history-enabled', enabled),
    onData: (callback) => ipcRenderer.on('history-data', (_, history) => callback(history)),
    onUpdated: (callback) => ipcRenderer.on('history-updated', (_, history) => callback(history)),
    onEnabledUpdated: (callback) => ipcRenderer.on('history-enabled-updated', (_, enabled) => callback(enabled))
  },

  // Dictionary management
  dictionary: {
    get: () => ipcRenderer.send('get-dictionary'),
    addWord: (hear, replace) => ipcRenderer.send('add-custom-word', hear, replace),
    removeWord: (hear) => ipcRenderer.send('remove-custom-word', hear),
    setName: (name) => ipcRenderer.send('set-name', name),
    enablePronouns: (enabled) => ipcRenderer.send('enable-pronoun-replacement', enabled),
    onData: (callback) => ipcRenderer.on('dictionary-data', (_, dict) => callback(dict)),
    onUpdated: (callback) => ipcRenderer.on('dictionary-updated', (_, dict) => callback(dict)),
    onError: (callback) => ipcRenderer.on('dictionary-error', (_, error) => callback(error))
  },

  // Language management
  language: {
    getSupportedLanguages: () => ipcRenderer.send('get-supported-languages'),
    getCurrent: () => ipcRenderer.send('get-current-language'),
    set: (languageCode) => ipcRenderer.send('set-language', languageCode),
    onSupportedLanguages: (callback) => ipcRenderer.on('supported-languages', (_, languages) => callback(languages)),
    onCurrent: (callback) => ipcRenderer.on('current-language', (_, language) => callback(language)),
    onUpdated: (callback) => ipcRenderer.on('language-updated', (_, language) => callback(language)),
    onError: (callback) => ipcRenderer.on('language-error', (_, error) => callback(error))
  },

  // Macro management
  macros: {
    get: () => ipcRenderer.send('get-macros'),
    add: (name, text) => ipcRenderer.send('add-macro', name, text),
    delete: (name) => ipcRenderer.send('delete-macro', name),
    onData: (callback) => ipcRenderer.on('macros-data', (_, macros) => callback(macros)),
    onUpdated: (callback) => ipcRenderer.on('macros-updated', (_, macros) => callback(macros)),
    onError: (callback) => ipcRenderer.on('macros-error', (_, error) => callback(error))
  },

  // Notes recording (in-app, no global hotkey)
  recording: {
    startNotes: () => ipcRenderer.send('start-notes-recording'),
    stopNotes: () => ipcRenderer.send('stop-notes-recording'),
    onNotesComplete: (callback) => ipcRenderer.on('notes-recording-complete', (_, text) => callback(text)),
    onNotesError: (callback) => ipcRenderer.on('notes-recording-error', (_, error) => callback(error))
  },

  // Audio capture for notes
  audioCapture: {
    onStart: (callback) => ipcRenderer.on('start-audio-capture', () => callback()),
    onStop: (callback) => ipcRenderer.on('stop-audio-capture', (_, filePath) => callback(filePath)),
    sendComplete: (audioBuffer) => ipcRenderer.send('audio-data-complete', audioBuffer)
  }
});

console.log('Main window preload script loaded');

