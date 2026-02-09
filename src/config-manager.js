'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/** Supported languages for transcription */
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'ko', name: 'Korean' }
];

/** Default hotkey keycodes (Ctrl+Shift) */
const DEFAULT_HOTKEY_KEYCODES = [29, 3613, 42, 54]; // CtrlLeft, CtrlRight, ShiftLeft, ShiftRight

/**
 * Manages application configuration persistence
 */
class ConfigManager {
  constructor() {
    const userDataPath = app.getPath('userData');

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this._load();
  }

  /**
   * Gets default configuration values
   * @returns {Object}
   */
  getDefaults() {
    return {
      hotkey: {
        displayString: 'Ctrl+Shift',
        keycodes: DEFAULT_HOTKEY_KEYCODES
      },
      toggleMode: false,
      historyEnabled: true,
      selectedModel: null,
      language: 'en',
      autoStart: false,
      minimizeToTray: true
    };
  }

  /**
   * Gets list of supported languages
   * @returns {Array<{code: string, name: string}>}
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Loads configuration from file
   * @private
   * @returns {Object}
   */
  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(data);
        return { ...this.getDefaults(), ...loadedConfig };
      }
    } catch (error) {
      console.error('Error loading config, using defaults:', error);
    }

    return this.getDefaults();
  }

  /**
   * Saves configuration to file
   * @returns {boolean} Success status
   */
  save() {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf8');
      console.log('Configuration saved to:', this.configPath);
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  /**
   * Gets a configuration value by key
   * @param {string} key - Configuration key (supports dot notation)
   * @returns {*}
   */
  get(key) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Sets a configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} value - Value to set
   */
  set(key, value) {
    const keys = key.split('.');
    let target = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
    this.save();
  }

  /**
   * Gets the entire configuration object
   * @returns {Object}
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Resets configuration to defaults
   */
  reset() {
    this.config = this.getDefaults();
    this.save();
  }
}

module.exports = ConfigManager;

