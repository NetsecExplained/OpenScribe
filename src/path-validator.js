'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');
const { getBinPath, getModelsPath } = require('./resource-path');

/** Patterns that indicate suspicious path manipulation */
const SUSPICIOUS_PATTERNS = [
  /\.\.[\/\\]/,  // Path traversal
  /[<>"|?*]/     // Invalid characters (: allowed for Windows drive letters)
];

/**
 * Validates file paths for security
 */
class PathValidator {
  constructor() {
    this.allowedDirs = {
      temp: os.tmpdir(),
      models: getModelsPath(),
      bin: getBinPath(),
      userData: app.getPath('userData')
    };
  }

  /**
   * Validates that a path is safe to use
   * @param {string} filePath - Path to validate
   * @param {string} expectedDir - Expected base directory type
   * @returns {{valid: boolean, error?: string, resolved?: string}}
   */
  validate(filePath, expectedDir) {
    try {
      if (!this.allowedDirs[expectedDir]) {
        return this._invalid(`Unknown directory type: ${expectedDir}`);
      }

      if (filePath.includes('\0')) {
        return this._invalid('Path contains null bytes');
      }

      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(filePath)) {
          return this._invalid('Path contains suspicious characters');
        }
      }

      const resolved = path.resolve(filePath);
      const baseDir = path.resolve(this.allowedDirs[expectedDir]);

      if (!this._isWithinDirectory(resolved, baseDir)) {
        return this._invalid(`Path outside allowed directory: ${expectedDir}`);
      }

      if (fs.existsSync(resolved) && !this._validateSymlink(resolved, baseDir)) {
        return this._invalid('Symlink points outside allowed directory');
      }

      return { valid: true, resolved };
    } catch (error) {
      return this._invalid(`Path validation error: ${error.message}`);
    }
  }

  /**
   * Validates an audio file path
   * @param {string} filePath - Path to validate
   * @returns {{valid: boolean, error?: string, resolved?: string}}
   */
  validateAudioPath(filePath) {
    const result = this.validate(filePath, 'temp');

    if (!result.valid) {
      return result;
    }

    if (!filePath.endsWith('.wav')) {
      return this._invalid('Audio file must be .wav format');
    }

    return result;
  }

  /**
   * Validates a model file path
   * @param {string} filePath - Path to validate
   * @returns {{valid: boolean, error?: string, resolved?: string}}
   */
  validateModelPath(filePath) {
    const result = this.validate(filePath, 'models');

    if (!result.valid) {
      return result;
    }

    if (!filePath.endsWith('.bin')) {
      return this._invalid('Model file must be .bin format');
    }

    return result;
  }

  /**
   * Validates an executable path
   * @param {string} filePath - Path to validate
   * @returns {{valid: boolean, error?: string, resolved?: string}}
   */
  validateExecutablePath(filePath) {
    const result = this.validate(filePath, 'bin');

    if (!result.valid) {
      return result;
    }

    if (process.platform === 'win32' && !filePath.endsWith('.exe')) {
      return this._invalid('Executable must be .exe format on Windows');
    }

    return result;
  }

  /**
   * Validates a user data file path
   * @param {string} filePath - Path to validate
   * @returns {{valid: boolean, error?: string, resolved?: string}}
   */
  validateUserDataPath(filePath) {
    const result = this.validate(filePath, 'userData');

    if (!result.valid) {
      return result;
    }

    if (!filePath.endsWith('.json')) {
      return this._invalid('User data file must be .json format');
    }

    return result;
  }

  /**
   * Creates an invalid result object
   * @private
   * @param {string} error - Error message
   * @returns {{valid: boolean, error: string}}
   */
  _invalid(error) {
    return { valid: false, error };
  }

  /**
   * Checks if a path is within a directory
   * @private
   * @param {string} filePath - Resolved file path
   * @param {string} baseDir - Base directory
   * @returns {boolean}
   */
  _isWithinDirectory(filePath, baseDir) {
    return filePath.startsWith(baseDir + path.sep) || filePath === baseDir;
  }

  /**
   * Validates symlinks don't escape allowed directory
   * @private
   * @param {string} filePath - Path to check
   * @param {string} baseDir - Allowed base directory
   * @returns {boolean}
   */
  _validateSymlink(filePath, baseDir) {
    const stats = fs.lstatSync(filePath);

    if (!stats.isSymbolicLink()) {
      return true;
    }

    const realPath = fs.realpathSync(filePath);
    return this._isWithinDirectory(realPath, baseDir);
  }
}

module.exports = PathValidator;

