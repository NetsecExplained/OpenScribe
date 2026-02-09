'use strict';

const path = require('path');
const { app, Menu, Tray, nativeImage } = require('electron');

/**
 * Manages the system tray icon and menu
 */
class TrayManager {
  /**
   * @param {BrowserWindow} mainWindow - Reference to main window
   */
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
    this.isRecording = false;

    this._createTray();
  }

  /**
   * Creates the system tray icon
   * @private
   */
  _createTray() {
    const iconPath = path.join(__dirname, '../public/assets/logo.png');
    let icon = nativeImage.createFromPath(iconPath);

    // Resize for tray (16x16 on most platforms, 22x22 on some Linux)
    if (!icon.isEmpty()) {
      icon = icon.resize({ width: 16, height: 16 });
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('OpenScribe - Ready');

    this._updateMenu();

    this.tray.on('click', () => this._toggleMainWindow());
  }

  /**
   * Toggles main window visibility
   * @private
   */
  _toggleMainWindow() {
    if (!this.mainWindow) {
      return;
    }

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
    }
  }

  /**
   * Updates the tray context menu
   * @private
   */
  _updateMenu() {
    const statusLabel = this.isRecording ? '🔴 Recording...' : '⭕ Ready';

    const template = [
      { label: 'OpenScribe', enabled: false },
      { type: 'separator' },
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Updates the recording state
   * @param {boolean} isRecording - Whether recording is active
   */
  setRecording(isRecording) {
    this.isRecording = isRecording;

    const tooltip = isRecording ? 'OpenScribe - 🔴 Recording...' : 'OpenScribe - Ready';
    this.tray.setToolTip(tooltip);

    this._updateMenu();
  }
}

module.exports = TrayManager;

