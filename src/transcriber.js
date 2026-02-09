'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const PathValidator = require('./path-validator');
const { getBinPath } = require('./resource-path');

/** Lines containing these strings are filtered from whisper output */
const WHISPER_NOISE_PATTERNS = ['whisper_', 'system_info', 'processing'];

/**
 * Handles transcription using whisper.cpp
 */
class Transcriber {
  /**
   * @param {ModelManager} modelManager - Model manager instance
   */
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.currentModel = null;
    this.currentLanguage = 'en';
    this.isInitialized = false;
    this.modelPath = null;
    this.pathValidator = new PathValidator();

    const exeName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    this.whisperExe = path.join(getBinPath(), 'Release', exeName);
  }

  /**
   * Initializes the transcriber with a model
   * @param {string} [modelName='tiny'] - Name of the model to use
   * @returns {Promise<boolean>}
   */
  async initialize(modelName = 'tiny') {
    try {
      const modelPath = this.modelManager.getModelPath(modelName);

      if (!this.modelManager.isModelDownloaded(modelName)) {
        throw new Error(`Model ${modelName} is not downloaded`);
      }

      const modelValidation = this.pathValidator.validateModelPath(modelPath);
      if (!modelValidation.valid) {
        throw new Error(`Invalid model path: ${modelValidation.error}`);
      }

      if (!fs.existsSync(this.whisperExe)) {
        throw new Error('Whisper executable not found. Please run setup.');
      }

      const exeValidation = this.pathValidator.validateExecutablePath(this.whisperExe);
      if (!exeValidation.valid) {
        throw new Error(`Invalid executable path: ${exeValidation.error}`);
      }

      console.log('Initializing Whisper with model:', modelName);
      this.currentModel = modelName;
      this.modelPath = modelValidation.resolved;
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('Failed to initialize transcriber:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Transcribes an audio file
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<string>} Transcribed text
   */
  async transcribe(audioFilePath) {
    if (!this.isInitialized) {
      throw new Error('Transcriber not initialized. Please select a model first.');
    }

    const audioValidation = this.pathValidator.validateAudioPath(audioFilePath);
    if (!audioValidation.valid) {
      throw new Error(`Invalid audio file path: ${audioValidation.error}`);
    }

    return new Promise((resolve, reject) => {
      console.log('Starting transcription...');
      console.log('Audio file:', audioValidation.resolved);
      console.log('Model:', this.modelPath);

      const args = [
        '-m', this.modelPath,
        '-f', audioValidation.resolved,
        '-nt',
        '-l', this.currentLanguage
      ];

      const spawnOptions = this._getSpawnOptions();
      const whisperProcess = spawn(this.whisperExe, args, spawnOptions);

      let output = '';
      let errorOutput = '';

      whisperProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log('Whisper output:', text);
        output += text;
      });

      whisperProcess.stderr.on('data', (data) => {
        const text = data.toString();
        console.log('Whisper stderr:', text);
        errorOutput += text;
      });

      whisperProcess.on('close', (code) => {
        console.log('Whisper process exited with code:', code);

        if (code !== 0) {
          reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
          return;
        }

        const transcription = this._parseTranscription(output);

        if (!transcription) {
          reject(new Error('No speech detected or transcription failed'));
          return;
        }

        console.log('Final transcription:', transcription);
        resolve(transcription);
      });

      whisperProcess.on('error', (err) => {
        console.error('Failed to start whisper process:', err);
        reject(new Error(`Failed to start Whisper: ${err.message}`));
      });
    });
  }

  /**
   * Gets spawn options for the whisper process
   * @private
   * @returns {Object}
   */
  _getSpawnOptions() {
    const options = {};

    if (process.platform === 'linux') {
      const libPath = path.join(getBinPath(), 'Release');
      const existingPath = process.env.LD_LIBRARY_PATH || '';
      options.env = {
        ...process.env,
        LD_LIBRARY_PATH: existingPath ? `${libPath}:${existingPath}` : libPath
      };
      console.log('LD_LIBRARY_PATH set to:', options.env.LD_LIBRARY_PATH);
    }

    return options;
  }

  /**
   * Parses transcription from whisper output
   * @private
   * @param {string} output - Raw whisper output
   * @returns {string} Cleaned transcription
   */
  _parseTranscription(output) {
    const lines = output.split('\n');
    const transcriptionParts = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('[')) {
        continue;
      }

      const isNoise = WHISPER_NOISE_PATTERNS.some(pattern => trimmed.includes(pattern));
      if (isNoise) {
        continue;
      }

      transcriptionParts.push(trimmed);
    }

    return transcriptionParts.join(' ').trim();
  }

  /**
   * Changes the current model
   * @param {string} modelName - Name of the model
   * @returns {Promise<boolean>}
   */
  changeModel(modelName) {
    return this.initialize(modelName);
  }

  /**
   * Sets the transcription language
   * @param {string} languageCode - ISO language code
   */
  setLanguage(languageCode) {
    this.currentLanguage = languageCode;
    console.log('Language changed to:', languageCode);
  }

  /**
   * Gets the current transcriber status
   * @returns {{initialized: boolean, currentModel: string|null, currentLanguage: string, modelPath: string|null}}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      currentModel: this.currentModel,
      currentLanguage: this.currentLanguage,
      modelPath: this.modelPath
    };
  }
}

module.exports = Transcriber;

