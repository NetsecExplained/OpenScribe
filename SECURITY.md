# Security Policy

## Supported Versions

Currently supported version with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.0   | :white_check_mark: |

## Security Features

This application implements multiple layers of security to protect user data and system integrity:

### 1. Model Integrity Verification

- **SHA256 Checksum Verification**: All Whisper model downloads are verified using SHA256 checksums
- **Hardcoded Checksums**: Checksums are hardcoded in the application from official Hugging Face model cards
- **Automatic Validation**: Downloaded files are automatically verified before use
- **Corruption Detection**: Files that fail checksum validation are rejected and deleted
- **Re-verification**: Existing models are re-verified on application startup

### 2. Path Validation & Injection Protection

- **Path Traversal Prevention**: All file paths are validated to prevent directory traversal attacks
- **Allowed Directory Restrictions**: File operations are restricted to authorized directories only:
  - Temporary files: OS temp directory
  - Models: Application models directory
  - Binaries: Application bin directory
  - User data: Electron userData directory
- **Symlink Validation**: Symbolic links are resolved and validated to ensure they don't escape allowed directories
- **Null Byte Protection**: Paths containing null bytes are rejected
- **Format Validation**: File extensions are validated for expected types (.wav, .bin, .exe, .json)

### 3. Context Isolation

- **No Direct Node.js Access**: Renderer processes run with `contextIsolation: true`
- **Secure Preload Scripts**: IPC communication is exposed through secure `contextBridge` APIs
- **Minimal API Surface**: Only necessary IPC channels are exposed to renderers
- **Read-Only API**: Exposed APIs cannot be modified by renderer code
- **Process Separation**: Main and renderer processes are strictly isolated

### 4. Process Isolation

- **Validated Child Processes**: All child process spawns use validated paths
- **No Shell Execution**: Direct `spawn()` calls without shell interpretation
- **Argument Validation**: No user-controlled arguments passed to external processes
- **Dedicated Path Validation**: Whisper executable paths are validated before use

### 5. Dependency Security

- **Clean Audit**: All dependencies pass `npm audit` with zero vulnerabilities
- **Minimal Dependencies**: Only essential packages are included:
  - `electron` (framework)
  - `uiohook-napi` (global hotkeys)
  - `clipboardy` (clipboard operations)

## Reporting a Vulnerability

**IMPORTANT: DO NOT open public issues for security vulnerabilities.**

If you discover a security vulnerability in this application, please report it responsibly:

### How to Report

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [Create a security contact email]
3. Include in your report:
   - Clear description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Suggested fix (if applicable)
   - Your contact information

### What to Expect

- **Initial Response**: Within 48 hours of report submission
- **Status Updates**: Regular updates on investigation progress
- **Resolution Timeline**: Coordinated disclosure after fix is available
- **Credit**: Public acknowledgment (if desired) in release notes

### Scope

Security reports are welcomed for:
- Remote code execution vulnerabilities
- Privilege escalation issues
- Path traversal attacks
- Injection vulnerabilities
- Authentication/authorization bypasses
- Data exposure issues
- Dependency vulnerabilities

Out of scope:
- Denial of service (local application)
- Issues requiring physical access to the device
- Social engineering attacks
- Issues in third-party dependencies already publicly disclosed

## Security Best Practices for Contributors

If you're contributing to this project, please follow these security guidelines:

### Code Security

1. **Never Disable Context Isolation**: Do not set `contextIsolation: false` or `nodeIntegration: true`
2. **Validate All Input**: Treat all user input and external data as untrusted
3. **Use Path Validation**: Always use `PathValidator` for file operations
4. **Verify Checksums**: Ensure downloaded files are verified before use
5. **No Dynamic Code**: Avoid `eval()`, `Function()`, or dynamic `require()`

### IPC Security

1. **Whitelist Channels**: Only expose necessary IPC channels through preload scripts
2. **Validate IPC Data**: Validate all data received from renderers
3. **Use `invoke/handle`**: Prefer promise-based IPC over event-based when possible
4. **No Sensitive Data**: Don't pass credentials or secrets through IPC

### File Operations

1. **Use path.join()**: Always use `path.join()` or `path.resolve()` for paths
2. **Validate Paths**: Run all paths through `PathValidator` before use
3. **Check Extensions**: Validate file extensions match expected types
4. **Handle Errors**: Properly handle file operation errors

### Dependency Management

1. **Regular Audits**: Run `npm audit` before committing
2. **Update Dependencies**: Keep dependencies up to date
3. **Review Changes**: Review dependency changelogs for security issues
4. **Minimize Dependencies**: Only add necessary packages

### Testing

1. **Test Path Traversal**: Include tests for `../` and symlink attacks
2. **Test Invalid Input**: Verify rejection of malformed data
3. **Test IPC Security**: Ensure `require()` is blocked in renderers
4. **Test Error Paths**: Verify security on error conditions

## Known Limitations

### Network Security

1. **HTTPS Only**: Model downloads use HTTPS but without certificate pinning
2. **Network Required**: Application requires network access for model downloads
3. **API Dependency**: Relies on Hugging Face API availability for checksums

### File System

1. **Temp Directory**: Audio files temporarily stored in OS temp directory
2. **No Encryption**: Local files (models, config, history) are not encrypted at rest
3. **File Permissions**: Relies on OS file permissions for access control

### System Access

1. **Global Hotkeys**: Requires system-level permission for hotkey registration
2. **Microphone Access**: Requires user permission for audio recording
3. **Clipboard Access**: Can read/write system clipboard when actively used

### Platform-Specific

1. **Windows Focus**: Path validation optimized for Windows (WSL2 environment)
2. **Binary Dependency**: Requires Whisper.cpp binary for transcription
3. **GPU Disabled**: Hardware acceleration disabled in WSL2

## Security Roadmap

Future enhancements under consideration:

- **Certificate Pinning**: Pin Hugging Face SSL certificates
- **File Encryption**: Encrypt stored transcription history
- **Audit Logging**: Log security-relevant events for forensics
- **Rate Limiting**: Limit download retry attempts
- **Auto-Updates**: Signed application updates
- **Content Security Policy**: Additional CSP headers for renderers

## Compliance

This application is designed with privacy-first principles:

- **Local Processing**: All speech-to-text processing happens locally
- **No Cloud by Default**: No data sent to external servers (except model downloads)
- **User Control**: Users control all data and settings
- **Transparent**: All code is open source and auditable

Suitable for:
- HIPAA-compliant workflows (with proper deployment)
- Sensitive data transcription
- Offline/air-gapped environments (after initial model download)

## Questions?

For security-related questions that are not vulnerabilities, you can:
- Open a GitHub discussion (for general security questions)
- Review the code security documentation
- Check existing security issues and discussions

Thank you for helping keep this application secure!
