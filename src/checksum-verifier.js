'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

/** Expected length of a SHA256 hash in hex */
const SHA256_HEX_LENGTH = 64;

/** Regex pattern for valid SHA256 hex string */
const SHA256_PATTERN = /^[a-f0-9]+$/i;

/**
 * Verifies file integrity using SHA256 checksums
 */
class ChecksumVerifier {
  constructor() {
    this.huggingFaceApi = 'https://huggingface.co';
  }

  /**
   * Calculates SHA256 hash of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} Hex string of SHA256 hash
   */
  calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Fetches expected SHA256 from Hugging Face API
   * @param {string} repoId - Repository ID (e.g., "ggerganov/whisper.cpp")
   * @param {string} filename - File name (e.g., "ggml-tiny.bin")
   * @returns {Promise<string>} Expected SHA256 hash
   */
  fetchExpectedChecksum(repoId, filename) {
    return new Promise((resolve, reject) => {
      const apiUrl = `${this.huggingFaceApi}/api/models/${repoId}/tree/main`;
      console.log('Fetching checksum from:', apiUrl);

      const options = {
        headers: { 'User-Agent': 'OpenScribe/0.2.0' }
      };

      https.get(apiUrl, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch checksum: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const sha256 = this._extractChecksumFromResponse(data, filename);
            console.log(`Expected SHA256 for ${filename}: ${sha256}`);
            resolve(sha256);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', err => {
        reject(new Error(`Network error fetching checksum: ${err.message}`));
      });
    });
  }

  /**
   * Verifies a file against an expected checksum
   * @param {string} filePath - Path to file
   * @param {string} expectedHash - Expected SHA256 hash
   * @returns {Promise<{valid: boolean, actual?: string, expected?: string, error?: string}>}
   */
  async verifyFile(filePath, expectedHash) {
    try {
      console.log('Verifying checksum for:', filePath);

      const actualHash = await this.calculateFileHash(filePath);
      console.log('Actual SHA256:', actualHash);
      console.log('Expected SHA256:', expectedHash);

      const valid = actualHash.toLowerCase() === expectedHash.toLowerCase();

      return { valid, actual: actualHash, expected: expectedHash };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Fetches checksum from a separate .sha256 file (fallback method)
   * @param {string} modelUrl - URL of the model file
   * @returns {Promise<string>} Expected SHA256 hash
   */
  fetchChecksumFromFile(modelUrl) {
    return new Promise((resolve, reject) => {
      const checksumUrl = `${modelUrl}.sha256`;
      console.log('Attempting to fetch checksum from:', checksumUrl);

      https.get(checksumUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Checksum file not found: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const hash = this._parseChecksumFile(data);
            resolve(hash);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Extracts checksum from Hugging Face API response
   * @private
   * @param {string} data - API response JSON
   * @param {string} filename - File to find
   * @returns {string} SHA256 hash
   */
  _extractChecksumFromResponse(data, filename) {
    const files = JSON.parse(data);
    const fileInfo = files.find(f => f.path === filename);

    if (!fileInfo) {
      throw new Error(`File ${filename} not found in repository`);
    }

    // Check for LFS sha256 first, then regular sha256
    const sha256 = (fileInfo.lfs && fileInfo.lfs.sha256) || fileInfo.sha256;

    if (!sha256) {
      throw new Error(`No SHA256 checksum available for ${filename}`);
    }

    return sha256;
  }

  /**
   * Parses a .sha256 checksum file
   * @private
   * @param {string} data - File contents
   * @returns {string} SHA256 hash
   */
  _parseChecksumFile(data) {
    const hash = data.trim().split(/\s+/)[0];

    if (hash.length !== SHA256_HEX_LENGTH || !SHA256_PATTERN.test(hash)) {
      throw new Error('Invalid checksum format');
    }

    return hash;
  }
}

module.exports = ChecksumVerifier;

