'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for the recording popup.
 * Exposes safe IPC APIs for recording UI.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Recording events (receive only)
  recording: {
    onStarted: (callback) => ipcRenderer.on('recording-started', (_, data) => callback(data)),
    onStopped: (callback) => ipcRenderer.on('recording-stopped', () => callback()),
    onTranscribing: (callback) => ipcRenderer.on('transcribing', () => callback()),
    onComplete: (callback) => ipcRenderer.on('transcription-complete', () => callback())
  },

  // Audio capture events
  audioCapture: {
    onStart: (callback) => ipcRenderer.on('start-audio-capture', () => callback()),
    onStop: (callback) => ipcRenderer.on('stop-audio-capture', (_, path) => callback(path)),
    sendError: (error) => ipcRenderer.send('audio-capture-error', error),
    sendComplete: (buffer) => ipcRenderer.send('audio-data-complete', buffer)
  },

  // Status updates
  status: {
    onShow: (callback) => ipcRenderer.on('show-status', (_, message) => callback(message)),
    onNotification: (callback) => ipcRenderer.on('show-notification', (_, message) => callback(message))
  }
});

console.log('Recording popup preload script loaded');

