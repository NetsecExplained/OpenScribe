'use strict';

const { clipboard } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');

/** Delay in ms after copying to clipboard */
const CLIPBOARD_PROPAGATION_DELAY = 10;

/** Delay in ms after paste to allow it to complete */
const PASTE_COMPLETION_DELAY = 30;

/**
 * Manages clipboard operations and paste simulation
 */
class ClipboardManager {
  constructor() {
    this.isMac = process.platform === 'darwin';
    this.pasteModifier = this.isMac ? UiohookKey.Meta : UiohookKey.Ctrl;
    this.modifierName = this.isMac ? 'Cmd' : 'Ctrl';
    console.log(`Platform: ${process.platform}, using ${this.modifierName}+V for paste`);
  }

  /**
   * Copies text to clipboard and pastes it to the active window
   * @param {string} text - Text to copy and paste
   * @returns {Promise<boolean>}
   */
  async copyAndPaste(text) {
    try {
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      console.log('Auto-pasting text:', preview);

      const originalClipboard = this._readClipboard();

      clipboard.writeText(text);
      console.log('Text copied to clipboard');

      await this._sleep(CLIPBOARD_PROPAGATION_DELAY);
      await this._simulatePaste();
      await this._sleep(PASTE_COMPLETION_DELAY);

      this._restoreClipboard(originalClipboard);

      return true;
    } catch (error) {
      console.error('Failed to copy and paste:', error);
      throw error;
    }
  }

  /**
   * Copies text to clipboard without pasting
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>}
   */
  async copyOnly(text) {
    try {
      clipboard.writeText(text);
      console.log('Text copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw error;
    }
  }

  /**
   * Reads current clipboard content
   * @private
   * @returns {string}
   */
  _readClipboard() {
    try {
      return clipboard.readText();
    } catch (err) {
      console.warn('Could not read clipboard:', err);
      return '';
    }
  }

  /**
   * Restores clipboard content if provided
   * @private
   * @param {string} content - Content to restore
   */
  _restoreClipboard(content) {
    if (content) {
      clipboard.writeText(content);
      console.log('Original clipboard restored');
    }
  }

  /**
   * Simulates a paste keyboard shortcut
   * @private
   * @returns {Promise<void>}
   */
  async _simulatePaste() {
    console.log(`Simulating ${this.modifierName}+V...`);

    try {
      uIOhook.keyTap(UiohookKey.V, [this.pasteModifier]);
      console.log('Paste simulation complete');
    } catch (error) {
      console.error('Failed to simulate paste:', error);
      console.log(`Text is in clipboard - paste manually with ${this.modifierName}+V`);
    }
  }

  /**
   * Promise-based sleep utility
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ClipboardManager;

