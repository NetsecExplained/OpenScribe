const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '..', 'bin');
const releaseDir = path.join(binDir, 'Release');

// Detect platform and architecture
const platform = process.platform; // 'win32', 'darwin', 'linux'
const arch = process.arch; // 'x64', 'arm64', etc.

// Determine executable name based on platform
let exeName;
if (platform === 'win32') {
  exeName = 'whisper-cli.exe';
} else {
  exeName = 'whisper-cli';
}

const whisperExe = path.join(releaseDir, exeName);

// Create directories
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Check if whisper already exists
if (fs.existsSync(whisperExe)) {
  console.log('Whisper executable already exists');
  process.exit(0);
}

// ============================================================================
// WINDOWS: Download pre-built binary
// ============================================================================
if (platform === 'win32') {
  console.log(`Downloading pre-built whisper.cpp for Windows (${arch})...`);
  console.log('This may take a moment...');

  const downloadUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip';
  const archivePath = path.join(binDir, 'whisper.zip');

  console.log(`URL: ${downloadUrl}`);

  function followRedirects(url, callback, redirectCount = 0) {
    if (redirectCount > 10) {
      callback(new Error('Too many redirects'));
      return;
    }

    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume(); // Drain the response

        // Handle relative URLs
        let redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).href;
        }

        followRedirects(redirectUrl, callback, redirectCount + 1);
        return;
      }

      if (response.statusCode !== 200) {
        callback(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      console.log('Download started...');
      callback(null, response);
    });

    request.on('error', (err) => {
      callback(err);
    });
  }

  followRedirects(downloadUrl, (err, response) => {
    if (err) {
      console.error('Download failed:', err.message);
      console.log('\nPlease manually download from:');
      console.log('https://github.com/ggml-org/whisper.cpp/releases/latest');
      console.log('Extract whisper-bin-x64.zip and copy whisper-cli.exe to the bin/Release/ folder');
      process.exit(1);
      return;
    }

    const file = fs.createWriteStream(archivePath);
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
      process.stdout.write(`\rDownloading: ${percent}%`);
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        console.log('\nDownload complete, extracting...');

        // Wait to ensure file is closed
        setTimeout(() => {
          try {
            // Windows: Use PowerShell
            const psCommand = `Expand-Archive -Path "${archivePath}" -DestinationPath "${binDir}" -Force`;
            execSync(`powershell -command "${psCommand}"`, {
              stdio: 'inherit'
            });

            console.log('Extraction complete!');

            // Find and move executable to Release directory
            const extractedFiles = fs.readdirSync(binDir);
            let mainFound = false;

            for (const file of extractedFiles) {
              if (file === 'whisper-cli.exe') {
                const srcPath = path.join(binDir, file);
                const destPath = whisperExe;

                if (srcPath !== destPath) {
                  fs.copyFileSync(srcPath, destPath);
                  console.log(`Moved ${file} to Release directory`);
                }

                mainFound = true;
                break;
              }
            }

            if (!mainFound) {
              console.log('⚠ Warning: Whisper executable not found in archive. Checking subdirectories...');
              // Search subdirectories
              const findExecutable = (dir) => {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                  const fullPath = path.join(dir, item);
                  const stat = fs.statSync(fullPath);

                  if (stat.isDirectory()) {
                    const found = findExecutable(fullPath);
                    if (found) return found;
                  } else if (item === 'whisper-cli.exe') {
                    return fullPath;
                  }
                }
                return null;
              };

              const foundPath = findExecutable(binDir);
              if (foundPath) {
                fs.copyFileSync(foundPath, whisperExe);
                console.log(`Found and moved executable from: ${foundPath}`);
                mainFound = true;
              }
            }

            console.log('Whisper.cpp setup complete!');

            // Verify executable exists
            if (fs.existsSync(whisperExe)) {
              console.log(`✓ ${exeName} found at: ${whisperExe}`);
            } else {
              console.log(`⚠ Warning: ${exeName} not found. Check bin folder manually.`);
            }

            // Clean up archive
            setTimeout(() => {
              try {
                if (fs.existsSync(archivePath)) {
                  fs.unlinkSync(archivePath);
                  console.log('Cleaned up archive file');
                }
              } catch (err) {
                // Ignore cleanup errors
              }
            }, 1000);

          } catch (err) {
            console.error('Extraction failed:', err.message);
            console.log('\nArchive saved at:', archivePath);
            console.log('Please extract it manually to:', binDir);
          }
        }, 500);
      });
    });

    file.on('error', (err) => {
      fs.unlink(archivePath, () => {});
      console.error('\nDownload error:', err.message);
      process.exit(1);
    });
  });
}

// ============================================================================
// LINUX & MAC: Compile from source
// ============================================================================
else if (platform === 'linux' || platform === 'darwin') {
  console.log(`Compiling whisper.cpp from source for ${platform === 'darwin' ? 'macOS' : 'Linux'}...`);

  // Check for required tools
  function checkCommand(command, name) {
    try {
      execSync(`${command} --version`, { stdio: 'ignore' });
      return true;
    } catch (err) {
      return false;
    }
  }

  // Check for git
  if (!checkCommand('git', 'git')) {
    console.error('Error: git is not installed.');
    console.log('Please install git first.');
    if (platform === 'linux') {
      console.log('  sudo apt update && sudo apt install git');
    } else {
      console.log('Git should be available after installing XCode Command Line Tools.');
      console.log('  xcode-select --install');
    }
    process.exit(1);
  }

  // Check for make
  if (!checkCommand('make', 'make')) {
    console.error('Error: make is not installed.');
    if (platform === 'linux') {
      console.log('Please install build-essential:');
      console.log('  sudo apt update && sudo apt install build-essential');
    } else {
      console.log('Please install XCode Command Line Tools:');
      console.log('  xcode-select --install');
      console.log('\nOr if already installed, try:');
      console.log('  sudo xcode-select --reset');
    }
    process.exit(1);
  }

  // Check for cmake
  if (!checkCommand('cmake', 'cmake')) {
    console.error('Error: cmake is not installed.');
    if (platform === 'linux') {
      console.log('Please install cmake:');
      console.log('  sudo apt update && sudo apt install cmake');
    } else {
      console.log('Please install cmake using Homebrew:');
      console.log('  brew install cmake');
      console.log('\nOr download from: https://cmake.org/download/');
    }
    process.exit(1);
  }

  console.log('✓ All required tools found (git, make, cmake)');

  // Clone and compile
  const tempDir = path.join(binDir, 'whisper-cpp-temp');

  try {
    // Clean up any previous temp directory
    if (fs.existsSync(tempDir)) {
      console.log('Cleaning up previous temp directory...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log('\nCloning whisper.cpp repository...');
    console.log('Repository: https://github.com/ggerganov/whisper.cpp.git');
    execSync(`git clone https://github.com/ggerganov/whisper.cpp.git "${tempDir}"`, {
      stdio: 'inherit'
    });

    console.log('\nCompiling whisper.cpp...');
    console.log('This may take a few minutes depending on your system...');
    execSync('make', {
      cwd: tempDir,
      stdio: 'inherit'
    });

    console.log('\nLooking for compiled binary...');

    // Try multiple possible locations for the compiled binary
    const possiblePaths = [
      path.join(tempDir, 'build', 'bin', 'whisper-cli'),
      path.join(tempDir, 'whisper-cli'),
      path.join(tempDir, 'main')
    ];

    let compiledBinary = null;
    for (const binaryPath of possiblePaths) {
      if (fs.existsSync(binaryPath)) {
        compiledBinary = binaryPath;
        console.log(`✓ Found compiled binary at: ${binaryPath}`);
        break;
      }
    }

    if (!compiledBinary) {
      throw new Error('Compiled binary not found at expected locations');
    }

    // Copy to release directory
    fs.copyFileSync(compiledBinary, whisperExe);
    console.log(`✓ Copied to: ${whisperExe}`);

    // Make executable on Unix
    fs.chmodSync(whisperExe, 0o755);
    console.log('✓ Set executable permissions');

    // Copy shared libraries (.so files) on Linux
    if (platform === 'linux') {
      console.log('\nCopying shared libraries...');

      // Look for .so files in the temp directory
      const findSharedLibs = (dir) => {
        const libs = [];
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            libs.push(...findSharedLibs(fullPath));
          } else if (item.endsWith('.so') || item.includes('.so.')) {
            libs.push(fullPath);
          }
        }

        return libs;
      };

      const sharedLibs = findSharedLibs(tempDir);

      if (sharedLibs.length > 0) {
        for (const lib of sharedLibs) {
          const libName = path.basename(lib);
          const destLib = path.join(releaseDir, libName);
          fs.copyFileSync(lib, destLib);
          console.log(`  ✓ Copied: ${libName}`);
        }
      } else {
        console.log('  ⚠ No shared libraries found (static build?)');
      }
    }

    console.log('\n✓ Whisper.cpp compiled successfully!');
    console.log(`✓ Executable: ${whisperExe}`);
    if (platform === 'linux') {
      console.log(`✓ Libraries: ${releaseDir}`);
    }

    // Clean up temp directory
    console.log('\nCleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✓ Cleanup complete');

    console.log('\n========================================');
    console.log('Whisper.cpp setup complete!');
    console.log('========================================');

  } catch (err) {
    console.error('\n========================================');
    console.error('Compilation failed:', err.message);
    console.error('========================================');

    // Clean up on failure
    if (fs.existsSync(tempDir)) {
      console.log('Cleaning up temporary files...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log('\nManual compilation steps:');
    console.log('1. git clone https://github.com/ggerganov/whisper.cpp.git');
    console.log('2. cd whisper.cpp');
    console.log('3. make');
    console.log(`4. Copy the compiled binary to: ${whisperExe}`);
    if (platform === 'linux' || platform === 'darwin') {
      console.log('   (Usually found at: ./whisper-cli)');
    }
    console.log(`5. chmod +x "${whisperExe}"`);

    process.exit(1);
  }
}

// Unsupported platform
else {
  console.error(`Unsupported platform: ${platform}`);
  console.log('Please manually compile whisper.cpp from:');
  console.log('https://github.com/ggerganov/whisper.cpp');
  process.exit(1);
}
