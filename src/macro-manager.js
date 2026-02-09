'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const PathValidator = require('./path-validator');

/** Pattern to match "insert [macro name]" in text */
const INSERT_PATTERN = /\binsert\s+([a-zA-Z0-9\s]+?)(?=\s|$|[.,!?])/gi;

/**
 * Manages text macros for expansion
 */
class MacroManager {
  constructor() {
    this.pathValidator = new PathValidator();
    this.macrosPath = path.join(app.getPath('userData'), 'macros.json');

    const validation = this.pathValidator.validateUserDataPath(this.macrosPath);
    if (!validation.valid) {
      throw new Error(`Invalid macros path: ${validation.error}`);
    }

    this.macros = this._load();
  }

  /**
   * Gets the default macros structure
   * @returns {Object}
   */
  getDefaultMacros() {
    return { macros: [] };
  }

  /**
   * Loads macros from file
   * @private
   * @returns {Object}
   */
  _load() {
    if (fs.existsSync(this.macrosPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.macrosPath, 'utf8'));
      } catch (error) {
        console.error('Failed to load macros, using defaults:', error);
      }
    }
    return this.getDefaultMacros();
  }

  /**
   * Saves macros to file
   */
  save() {
    try {
      fs.writeFileSync(this.macrosPath, JSON.stringify(this.macros, null, 2));
      console.log('Macros saved successfully');
    } catch (error) {
      console.error('Failed to save macros:', error);
      throw error;
    }
  }

  /**
   * Adds or updates a macro
   * @param {string} name - Macro name
   * @param {string} text - Macro expansion text
   */
  addMacro(name, text) {
    const nameLower = name.toLowerCase();
    const existingIndex = this.macros.macros.findIndex(
      m => m.name.toLowerCase() === nameLower
    );

    if (existingIndex !== -1) {
      this.macros.macros[existingIndex].text = text;
    } else {
      this.macros.macros.push({
        id: Date.now().toString(),
        name,
        text
      });
    }

    this.save();
  }

  /**
   * Deletes a macro by name
   * @param {string} name - Macro name to delete
   */
  deleteMacro(name) {
    const nameLower = name.toLowerCase();
    this.macros.macros = this.macros.macros.filter(
      m => m.name.toLowerCase() !== nameLower
    );
    this.save();
  }

  /**
   * Gets all macros
   * @returns {Object}
   */
  getMacros() {
    return this.macros;
  }

  /**
   * Expands macros in text
   * @param {string} text - Text containing macro references
   * @returns {string} Text with macros expanded
   */
  expandMacros(text) {
    if (!text || text.length === 0) {
      return text;
    }

    return text.replace(INSERT_PATTERN, (match, macroName) => {
      const trimmedName = macroName.trim();
      const macro = this._findMacro(trimmedName);

      if (macro) {
        const preview = macro.text.length > 50 ? macro.text.substring(0, 50) + '...' : macro.text;
        console.log(`Expanding macro: "${trimmedName}" → "${preview}"`);
        return macro.text;
      }

      return match;
    });
  }

  /**
   * Finds a macro by name (case-insensitive)
   * @private
   * @param {string} name - Macro name
   * @returns {Object|undefined}
   */
  _findMacro(name) {
    const nameLower = name.toLowerCase();
    return this.macros.macros.find(m => m.name.toLowerCase() === nameLower);
  }
}

module.exports = MacroManager;

