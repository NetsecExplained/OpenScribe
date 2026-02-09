'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const PathValidator = require('./path-validator');
const ChecksumVerifier = require('./checksum-verifier');
const { getModelsPath } = require('./resource-path');

/** Maximum number of HTTP redirects to follow */
const MAX_REDIRECTS = 5;

/** HTTP status codes that indicate a redirect */
const REDIRECT_CODES = [301, 302, 303, 307, 308];

/**
 * Manages model downloads and verification
 */
class ModelManager {
  constructor() {
    this.modelsDir = getModelsPath();
    this.pathValidator = new PathValidator();
    this.checksumVerifier = new ChecksumVerifier();

    this.models = {
      tiny: {
        name: 'tiny',
        filename: 'ggml-tiny.bin',
        size: '75 MB',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
        description: 'Fast, good for short phrases'
      },
      base: {
        name: 'base',
        filename: 'ggml-base.bin',
        size: '142 MB',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
        description: 'Balanced speed and accuracy'
      },
      small: {
        name: 'small',
        filename: 'ggml-small.bin',
        size: '466 MB',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
        description: 'Most accurate, slower'
      }
    };

    this._ensureModelsDir();
  }

  /**
   * Creates the models directory if it doesn't exist
   * @private
   */
  _ensureModelsDir() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      console.log('Created models directory:', this.modelsDir);
    }
  }

  /**
   * Gets the full path for a model
   * @param {string} modelName - Name of the model
   * @returns {string} Validated model path
   */
  getModelPath(modelName) {
    const model = this.models[modelName];
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const modelPath = path.join(this.modelsDir, model.filename);
    const validation = this.pathValidator.validateModelPath(modelPath);

    if (!validation.valid) {
      throw new Error(`Invalid model path: ${validation.error}`);
    }

    return validation.resolved;
  }

  /**
   * Checks if a model is downloaded
   * @param {string} modelName - Name of the model
   * @returns {boolean}
   */
  isModelDownloaded(modelName) {
    const modelPath = this.getModelPath(modelName);
    return fs.existsSync(modelPath);
  }

  /**
   * Gets list of downloaded model names
   * @returns {string[]}
   */
  getDownloadedModels() {
    return Object.keys(this.models).filter(name => this.isModelDownloaded(name));
  }

  /**
   * Checks if any model is downloaded
   * @returns {boolean}
   */
  hasAnyModel() {
    return this.getDownloadedModels().length > 0;
  }

  /**
   * Downloads a model with progress reporting
   * @param {string} modelName - Name of the model to download
   * @param {Function} [onProgress] - Progress callback
   * @returns {Promise<string>} Path to downloaded model
   */
  async downloadModel(modelName, onProgress) {
    const model = this.models[modelName];
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const modelPath = this.getModelPath(modelName);

    if (fs.existsSync(modelPath)) {
      const isValid = await this._verifyExistingModel(modelPath, model);
      if (isValid) {
        return modelPath;
      }
    }

    console.log(`Downloading ${modelName} model from ${model.url}...`);
    console.log('Expected checksum:', model.sha256);

    return this._downloadFile(model.url, modelPath, model.sha256, modelName, onProgress);
  }

  /**
   * Verifies an existing model file
   * @private
   */
  async _verifyExistingModel(modelPath, model) {
    console.log(`Model ${model.name} already exists, verifying integrity...`);

    try {
      const verification = await this.checksumVerifier.verifyFile(modelPath, model.sha256);

      if (verification.valid) {
        console.log(`Model ${model.name} integrity verified`);
        return true;
      }

      console.warn(`Model ${model.name} failed integrity check, re-downloading...`);
      fs.unlinkSync(modelPath);
      return false;
    } catch (error) {
      console.warn('Could not verify existing model:', error.message);
      return false;
    }
  }

  /**
   * Downloads a file with redirect support
   * @private
   */
  _downloadFile(url, destPath, expectedChecksum, modelName, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);

      const download = (currentUrl, redirectCount = 0) => {
        if (redirectCount > MAX_REDIRECTS) {
          reject(new Error('Too many redirects'));
          return;
        }

        https.get(currentUrl, (response) => {
          if (REDIRECT_CODES.includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            console.log('Following redirect to:', redirectUrl);
            response.resume();
            download(redirectUrl, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }

          this._handleDownloadResponse(response, file, destPath, expectedChecksum, modelName, onProgress)
            .then(resolve)
            .catch(reject);
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      };

      download(url);
    });
  }

  /**
   * Handles the download response stream
   * @private
   */
  _handleDownloadResponse(response, file, destPath, expectedChecksum, modelName, onProgress) {
    return new Promise((resolve, reject) => {
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress) {
          onProgress({
            downloaded: downloadedSize,
            total: totalSize,
            progress: ((downloadedSize / totalSize) * 100).toFixed(1),
            stage: 'downloading'
          });
        }
      });

      response.pipe(file);

      file.on('finish', async () => {
        file.close();
        console.log(`Model ${modelName} downloaded, verifying checksum...`);

        try {
          if (onProgress) {
            onProgress({
              downloaded: totalSize,
              total: totalSize,
              progress: 100,
              stage: 'verifying'
            });
          }

          const verification = await this.checksumVerifier.verifyFile(destPath, expectedChecksum);

          if (!verification.valid) {
            fs.unlinkSync(destPath);
            reject(new Error(
              `Checksum verification failed!\n` +
              `Expected: ${verification.expected}\n` +
              `Actual: ${verification.actual}\n` +
              `The download may be corrupted or compromised.`
            ));
            return;
          }

          console.log(`Model ${modelName} verified successfully`);
          resolve(destPath);
        } catch (error) {
          fs.unlinkSync(destPath);
          reject(new Error(`Verification error: ${error.message}`));
        }
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
  /**
   * Deletes a downloaded model
   * @param {string} modelName - Name of the model to delete
   * @returns {boolean} Whether the model was deleted
   */
  deleteModel(modelName) {
    const modelPath = this.getModelPath(modelName);

    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
      console.log('Deleted model:', modelName);
      return true;
    }

    return false;
  }

  /**
   * Gets information about all models
   * @returns {Object} Model information keyed by name
   */
  getModelInfo() {
    const info = {};

    for (const [name, model] of Object.entries(this.models)) {
      info[name] = {
        ...model,
        downloaded: this.isModelDownloaded(name),
        path: this.getModelPath(name)
      };
    }

    return info;
  }
}

module.exports = ModelManager;

