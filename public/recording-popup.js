'use strict';

// ===========================================
// Constants
// ===========================================

const WAVEFORM_BAR_COUNT = 10;
const WAVEFORM_MIN_HEIGHT = 2;
const WAVEFORM_MAX_HEIGHT = 18;
const WAVEFORM_ANIMATION_INTERVAL = 100;
const AUDIO_SAMPLE_RATE = 16000;
const AUDIO_CHUNK_INTERVAL = 100;
const WAV_HEADER_SIZE = 44;

// ===========================================
// DOM Elements
// ===========================================

const waveformContainer = document.getElementById('waveform');
const spinnerElement = document.getElementById('spinner');
const statusTextElement = document.getElementById('status-text');
const startSoundElement = document.getElementById('start-sound');
const stopSoundElement = document.getElementById('stop-sound');

// ===========================================
// State
// ===========================================

const bars = [];
let animationInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

// ===========================================
// Waveform Animation
// ===========================================

/**
 * Initializes waveform bars
 */
function initializeWaveform() {
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.height = `${WAVEFORM_MIN_HEIGHT}px`;
    waveformContainer.appendChild(bar);
    bars.push(bar);
  }
}

/**
 * Starts the waveform animation
 */
function startWaveformAnimation() {
  animationInterval = setInterval(() => {
    bars.forEach(bar => {
      const randomHeight = WAVEFORM_MIN_HEIGHT + Math.random() * (WAVEFORM_MAX_HEIGHT - WAVEFORM_MIN_HEIGHT);
      bar.style.height = `${randomHeight}px`;
    });
  }, WAVEFORM_ANIMATION_INTERVAL);
}

/**
 * Stops the waveform animation and resets bars
 */
function stopWaveformAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }

  bars.forEach(bar => {
    bar.style.height = `${WAVEFORM_MIN_HEIGHT}px`;
  });
}

// ===========================================
// UI State Management
// ===========================================

/**
 * Shows the recording state
 * @param {boolean} isToggleMode - Whether toggle mode is active
 */
function showRecordingState(isToggleMode) {
  waveformContainer.classList.remove('hidden');
  spinnerElement.classList.remove('active');
  startWaveformAnimation();

  statusTextElement.textContent = isToggleMode ? 'RECORDING - Toggle' : 'Recording...';
}

/**
 * Shows the transcribing state
 */
function showTranscribingState() {
  stopWaveformAnimation();
  waveformContainer.classList.add('hidden');
  spinnerElement.classList.add('active');
  statusTextElement.textContent = 'Transcribing...';
}

/**
 * Resets to idle state
 */
function resetToIdleState() {
  waveformContainer.classList.remove('hidden');
  spinnerElement.classList.remove('active');
}

/**
 * Plays a sound element safely
 * @param {HTMLAudioElement} soundElement - Audio element to play
 */
function playSound(soundElement) {
  if (soundElement) {
    soundElement.play().catch(() => {
      // Ignore playback errors (common with autoplay restrictions)
    });
  }
}

// ===========================================
// Recording Event Handlers
// ===========================================

window.electronAPI.recording.onStarted((data) => {
  console.log('Recording popup: recording started');
  showRecordingState(data && data.toggleMode);
  playSound(startSoundElement);
});

window.electronAPI.recording.onStopped(() => {
  console.log('Recording popup: recording stopped');
  stopWaveformAnimation();
  playSound(stopSoundElement);
});

window.electronAPI.recording.onTranscribing(() => {
  console.log('Recording popup: transcribing');
  showTranscribingState();
});

window.electronAPI.recording.onComplete(() => {
  console.log('Recording popup: transcription complete');
  resetToIdleState();
});

window.electronAPI.status.onNotification((message) => {
  console.log('Notification:', message);
});

window.electronAPI.status.onShow((message) => {
  const textElement = document.querySelector('.text');
  if (textElement) {
    textElement.textContent = message;
  }
  stopWaveformAnimation();
});

// ===========================================
// Audio Capture
// ===========================================

/**
 * Starts audio capture from the microphone
 */
async function startAudioCapture() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: AUDIO_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    audioChunks = [];

    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(AUDIO_CHUNK_INTERVAL);
    console.log('Audio capture started');
  } catch (err) {
    console.error('Failed to start audio capture:', err);
    window.electronAPI.audioCapture.sendError(err.message);
  }
}

/**
 * Stops audio capture and sends the data
 */
async function stopAudioCapture() {
  try {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.error('MediaRecorder not active');
      return;
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
      const wavBuffer = await convertToWav(audioBlob);

      window.electronAPI.audioCapture.sendComplete(wavBuffer);

      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }

      console.log('Audio capture completed');
    };

    mediaRecorder.stop();
  } catch (err) {
    console.error('Failed to stop audio capture:', err);
  }
}

window.electronAPI.audioCapture.onStart(startAudioCapture);
window.electronAPI.audioCapture.onStop(stopAudioCapture);

// ===========================================
// Audio Conversion
// ===========================================

/**
 * Converts WebM/Opus audio to WAV format
 * @param {Blob} audioBlob - Audio blob to convert
 * @returns {Promise<Uint8Array>} WAV buffer
 */
async function convertToWav(audioBlob) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavBuffer = audioBufferToWav(audioBuffer);

        resolve(wavBuffer);
      } catch (err) {
        reject(err);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(audioBlob);
  });
}

/**
 * Converts an AudioBuffer to WAV format
 * @param {AudioBuffer} audioBuffer - Audio buffer to convert
 * @returns {Uint8Array} WAV buffer
 */
function audioBufferToWav(audioBuffer) {
  const numberOfChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const channelData = audioBuffer.getChannelData(0);
  const samples = new Int16Array(channelData.length);

  // Convert float32 to int16
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }

  // Create WAV file buffer
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + samples.length * 2);
  const view = new DataView(buffer);

  // Write WAV header
  writeWavHeader(view, {
    sampleRate,
    numberOfChannels,
    bitDepth,
    format,
    dataLength: samples.length * 2
  });

  // Write audio data
  const dataOffset = WAV_HEADER_SIZE;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(dataOffset + i * 2, samples[i], true);
  }

  return new Uint8Array(buffer);
}

/**
 * Writes WAV header to a DataView
 * @param {DataView} view - DataView to write to
 * @param {Object} params - Header parameters
 */
function writeWavHeader(view, { sampleRate, numberOfChannels, bitDepth, format, dataLength }) {
  const byteRate = sampleRate * numberOfChannels * bitDepth / 8;
  const blockAlign = numberOfChannels * bitDepth / 8;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
}

/**
 * Writes a string to a DataView
 * @param {DataView} view - DataView to write to
 * @param {number} offset - Byte offset
 * @param {string} string - String to write
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ===========================================
// Initialization
// ===========================================

initializeWaveform();
