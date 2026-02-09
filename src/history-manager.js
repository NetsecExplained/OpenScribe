'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/** Maximum number of history entries to retain */
const MAX_HISTORY_ENTRIES = 100;

/**
 * Manages transcription history persistence
 */
class HistoryManager {
  constructor() {
    const userDataPath = app.getPath('userData');

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.historyPath = path.join(userDataPath, 'transcriptions.json');
    this.history = this._load();
  }

  /**
   * Loads history from file
   * @private
   * @returns {Array}
   */
  _load() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
    return [];
  }

  /**
   * Saves history to file
   * @returns {boolean} Success status
   */
  save() {
    try {
      const data = JSON.stringify(this.history, null, 2);
      fs.writeFileSync(this.historyPath, data, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving history:', error);
      return false;
    }
  }

  /**
   * Adds an entry to history
   * @param {Object} entry - History entry to add
   */
  add(entry) {
    this.history.unshift(entry);

    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(0, MAX_HISTORY_ENTRIES);
    }

    this.save();
  }

  /**
   * Gets all history entries
   * @returns {Array}
   */
  getAll() {
    return this.history;
  }

  /**
   * Gets recent history entries
   * @param {number} [limit=50] - Maximum entries to return
   * @returns {Array}
   */
  getRecent(limit = 50) {
    return this.history.slice(0, limit);
  }

  /**
   * Deletes an entry by ID
   * @param {number} id - Entry ID to delete
   */
  delete(id) {
    this.history = this.history.filter(entry => entry.id !== id);
    this.save();
  }

  /**
   * Clears all history
   */
  clear() {
    this.history = [];
    this.save();
  }
}

module.exports = HistoryManager;

