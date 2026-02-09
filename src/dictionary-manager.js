'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const PathValidator = require('./path-validator');

/** Default pronoun replacement templates */
const DEFAULT_PRONOUN_REPLACEMENTS = {
  'I': '{name}',
  'my': "{name}'s",
  'me': '{name}',
  "I'm": '{name} is',
  "I've": '{name} has'
};

/**
 * Manages custom word dictionary and pronoun replacements
 */
class DictionaryManager {
  constructor() {
    this.pathValidator = new PathValidator();
    this.dictionaryPath = path.join(app.getPath('userData'), 'dictionary.json');

    const validation = this.pathValidator.validateUserDataPath(this.dictionaryPath);
    if (!validation.valid) {
      throw new Error(`Invalid dictionary path: ${validation.error}`);
    }

    this.dictionary = this._load();
  }

  /**
   * Gets the default dictionary structure
   * @returns {Object}
   */
  getDefaultDictionary() {
    return {
      customWords: [],
      pronounReplacements: {
        enabled: false,
        name: '',
        replacements: { ...DEFAULT_PRONOUN_REPLACEMENTS }
      }
    };
  }

  /**
   * Loads dictionary from file
   * @private
   * @returns {Object}
   */
  _load() {
    if (fs.existsSync(this.dictionaryPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.dictionaryPath, 'utf8'));
      } catch (error) {
        console.error('Failed to load dictionary, using defaults:', error);
      }
    }
    return this.getDefaultDictionary();
  }

  /**
   * Saves dictionary to file
   */
  save() {
    try {
      fs.writeFileSync(this.dictionaryPath, JSON.stringify(this.dictionary, null, 2));
      console.log('Dictionary saved successfully');
    } catch (error) {
      console.error('Failed to save dictionary:', error);
      throw error;
    }
  }

  /**
   * Adds or updates a custom word replacement
   * @param {string} hear - Word to listen for
   * @param {string} replace - Replacement text
   */
  addCustomWord(hear, replace) {
    const hearLower = hear.toLowerCase();
    const existing = this.dictionary.customWords.find(word => word.hear === hearLower);

    if (existing) {
      existing.replace = replace;
    } else {
      this.dictionary.customWords.push({ hear: hearLower, replace });
    }

    this.save();
  }

  /**
   * Removes a custom word
   * @param {string} hear - Word to remove
   */
  removeCustomWord(hear) {
    const hearLower = hear.toLowerCase();
    this.dictionary.customWords = this.dictionary.customWords.filter(
      word => word.hear !== hearLower
    );
    this.save();
  }

  /**
   * Sets the name for pronoun replacement
   * @param {string} name - Name to use
   */
  setName(name) {
    this.dictionary.pronounReplacements.name = name;
    this.save();
  }

  /**
   * Enables or disables pronoun replacement
   * @param {boolean} enabled - Whether to enable
   */
  enablePronounReplacement(enabled) {
    this.dictionary.pronounReplacements.enabled = enabled;
    this.save();
  }

  /**
   * Gets the current dictionary
   * @returns {Object}
   */
  getDictionary() {
    return this.dictionary;
  }

  /**
   * Applies all replacements to text
   * @param {string} text - Text to process
   * @returns {string} Processed text
   */
  applyReplacements(text) {
    if (!text || text.length === 0) {
      return text;
    }

    let result = this._applyCustomWords(text);
    result = this._applyPronounReplacements(result);

    return result;
  }

  /**
   * Applies custom word replacements
   * @private
   * @param {string} text - Text to process
   * @returns {string}
   */
  _applyCustomWords(text) {
    let result = text;

    for (const word of this.dictionary.customWords) {
      const regex = new RegExp(`\\b${this._escapeRegex(word.hear)}\\b`, 'gi');
      result = result.replace(regex, word.replace);
    }

    return result;
  }

  /**
   * Applies pronoun replacements if enabled
   * @private
   * @param {string} text - Text to process
   * @returns {string}
   */
  _applyPronounReplacements(text) {
    const { enabled, name, replacements } = this.dictionary.pronounReplacements;

    if (!enabled || !name) {
      return text;
    }

    let result = text;

    for (const [pronoun, template] of Object.entries(replacements)) {
      const replacement = template.replace('{name}', name);
      const regex = new RegExp(`\\b${this._escapeRegex(pronoun)}\\b`, 'g');
      result = result.replace(regex, replacement);
    }

    return result;
  }

  /**
   * Escapes special regex characters
   * @private
   * @param {string} string - String to escape
   * @returns {string}
   */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = DictionaryManager;

