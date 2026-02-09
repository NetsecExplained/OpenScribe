'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain } = require('electron');
const PathValidator = require('./path-validator');

/**
 * Manages audio recording via the renderer process
 */
class AudioRecorder {
  constructor() {
    this.isRecording = false;
    this.currentFile = null;
    this.recordingWindow = null;
    this.pathValidator = new PathValidator();
  }

  /**
   * Starts audio recording
   * @param {BrowserWindow} recordingWindow - Window to use for audio capture
   */
  start(recordingWindow) {
    const tempPath = path.join(os.tmpdir(), `openscribe-${Date.now()}.wav`);

    const validation = this.pathValidator.validateAudioPath(tempPath);
    if (!validation.valid) {
      throw new Error(`Invalid audio path: ${validation.error}`);
    }

    this.isRecording = true;
    this.currentFile = validation.resolved;
    this.recordingWindow = recordingWindow;

    console.log('Starting audio recording to:', this.currentFile);

    if (this._isWindowAvailable()) {
      this.recordingWindow.webContents.send('start-audio-capture');
    }
  }

  /**
   * Stops audio recording and saves the file
   * @returns {Promise<string>} Path to the saved audio file
   */
  stop() {
    return new Promise((resolve, reject) => {
      this.isRecording = false;
      console.log('Stopping audio recording...');

      if (!this._isWindowAvailable()) {
        reject(new Error('Recording window not available'));
        return;
      }

      const handler = (event, audioBuffer) => {
        try {
          fs.writeFileSync(this.currentFile, Buffer.from(audioBuffer));
          console.log('Audio file saved:', this.currentFile);
          ipcMain.removeListener('audio-data-complete', handler);
          resolve(this.currentFile);
        } catch (err) {
          ipcMain.removeListener('audio-data-complete', handler);
          reject(err);
        }
      };

      ipcMain.once('audio-data-complete', handler);
      this.recordingWindow.webContents.send('stop-audio-capture', this.currentFile);
    });
  }

  /**
   * Cleans up temporary audio files
   */
  cleanup() {
    if (this.currentFile && fs.existsSync(this.currentFile)) {
      try {
        fs.unlinkSync(this.currentFile);
        console.log('Cleaned up temp audio file');
      } catch (err) {
        console.error('Failed to cleanup temp file:', err);
      }
    }
    this.currentFile = null;
  }

  /**
   * Checks if the recording window is available
   * @private
   * @returns {boolean}
   */
  _isWindowAvailable() {
    return this.recordingWindow && !this.recordingWindow.isDestroyed();
  }
}

module.exports = AudioRecorder;

