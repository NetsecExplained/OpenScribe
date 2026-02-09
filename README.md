<p align="center">
  <img src="public/assets/logo-long.png" alt="OpenScribe" width="400">
</p>

<p align="center">
  A privacy-focused local speech-to-text application with global hotkeys for seamless dictation across any application.
</p>

## Features

**Local, offline transcription** using Whisper.cpp — no cloud services, no telemetry, no data leaves your machine. Suitable for sensitive and HIPAA-adjacent workflows.

Global hotkey activation (hold-to-talk or toggle mode), automatic paste into any application, real-time waveform feedback, custom dictionary with word/phrase replacement, voice-triggered macros, transcription history with search, multi-language support (10 languages), multiple Whisper model sizes (tiny through medium), and system tray integration. Works on Windows, macOS (Intel & Apple Silicon), and Linux.

## Installation

### Prerequisites

- Node.js v16+
- **Linux**: `git`, `cmake`, `build-essential` (`sudo apt install git cmake build-essential`)
- **Mac**: Xcode Command Line Tools (`xcode-select --install`), optionally `cmake` via Homebrew
- **Windows**: No additional dependencies

### Quick Start

```bash
git clone https://github.com/NetsecExplained/OpenScribe.git
cd OpenScribe
npm install
npm start
```

On Windows, a pre-built whisper.cpp binary is downloaded automatically. On Linux/Mac, whisper.cpp is compiled from source during `npm install` (takes 2-5 minutes).

For development mode with DevTools: `npm run dev`

### Platform Notes

**Linux** — You may need to fix the Chromium sandbox:
```bash
sudo chown root ./node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 ./node_modules/electron/dist/chrome-sandbox
```

**Mac** — You may need to allow the app in System Preferences > Security & Privacy.

### Building Distributables

```bash
npm run dist          # Current platform
npm run dist:win      # Windows (.exe installer + portable)
npm run dist:mac      # macOS (.dmg + .zip)
npm run dist:linux    # Linux (.AppImage + .deb)
```

Output goes to `dist/`. Cross-platform builds have limitations — build on the target platform for best results.

## Usage

### First-Time Setup

1. Go to the **Models** tab and download a model (`tiny` ~75 MB, `base` ~142 MB, `small` ~466 MB, or `medium` ~1.5 GB).
2. Click **Select** on your downloaded model.
3. Optionally choose a language in the **Settings** tab.

### Recording

Hold your hotkey (default: `Ctrl+Shift`) and speak. Release to stop — transcribed text is automatically pasted into the active application. You can switch to toggle mode (press once to start, again to stop) in Settings.

### Dictionary & Macros

In the **Dictionary** tab you can add word/phrase replacements applied to all future transcriptions. Voice macros let you insert pre-defined text blocks by saying "insert [macro name]" during dictation.

### History

The **History** tab stores past transcriptions. You can copy, delete individual entries, or clear all. History can be disabled in Settings.

## Troubleshooting

**Linux: `cmake` or `make` not found**
```bash
sudo apt update && sudo apt install cmake build-essential
```

**Mac: No developer tools found**
```bash
xcode-select --install
```

**Mac: `cmake` not found**
```bash
brew install cmake
```

**Whisper.cpp compilation fails** — You can compile manually:
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp && make
```
Copy `build/bin/whisper-cli` to `OpenScribe/bin/Release/main` and `chmod +x` it (Linux/Mac). On Windows, download from the [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases).

**Terminal paste limitation** — Auto-paste uses Ctrl+V/Cmd+V which doesn't work in some terminal emulators. Use the notes section or a separate text file to first transcribe then manually copy/paste into terminal.


## License

MIT
