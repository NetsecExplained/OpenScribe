'use strict';

const path = require('path');
const { app } = require('electron');

/**
 * Gets the correct base path for external resources (bin, models).
 * In development: uses app.getAppPath() (project root)
 * When packaged: uses process.resourcesPath (extraResources location)
 * @returns {string} Base path for resources
 */
function getResourcePath() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return app.getAppPath();
}

/**
 * Gets the path to the bin directory
 * @returns {string} Path to bin directory
 */
function getBinPath() {
  return path.join(getResourcePath(), 'bin');
}

/**
 * Gets the path to the models directory
 * @returns {string} Path to models directory
 */
function getModelsPath() {
  return path.join(getResourcePath(), 'models');
}

module.exports = {
  getResourcePath,
  getBinPath,
  getModelsPath
};
