'use strict';

const { uIOhook } = require('uiohook-napi');

/** System shortcuts that cannot be used as hotkeys */
const FORBIDDEN_SHORTCUTS = [
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y',
  'Ctrl+A', 'Ctrl+S', 'Ctrl+N', 'Ctrl+O', 'Ctrl+P', 'Ctrl+W', 'Ctrl+Q',
  'Alt+Tab', 'Alt+F4',
  'Ctrl+Shift+Esc', 'Ctrl+Alt+Delete',
  'Ctrl+Tab'
];

/** Modifier key codes for left and right variants */
const MODIFIER_KEYCODES = {
  ctrl: [29, 3613],   // CtrlLeft, CtrlRight
  shift: [42, 54],    // ShiftLeft, ShiftRight
  alt: [56, 3640],    // AltLeft, AltRight
  meta: [3675, 3676]  // MetaLeft, MetaRight
};

/** Key to keycode mapping */
const KEY_MAP = {
  // Letters
  'A': 30, 'B': 48, 'C': 46, 'D': 32, 'E': 18, 'F': 33, 'G': 34, 'H': 35,
  'I': 23, 'J': 36, 'K': 37, 'L': 38, 'M': 50, 'N': 49, 'O': 24, 'P': 25,
  'Q': 16, 'R': 19, 'S': 31, 'T': 20, 'U': 22, 'V': 47, 'W': 17, 'X': 45,
  'Y': 21, 'Z': 44,
  // Numbers
  '0': 11, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
  // Special keys
  'SPACE': 57, 'ENTER': 28, 'ESCAPE': 1, 'BACKSPACE': 14, 'TAB': 15,
  // Function keys
  'F1': 59, 'F2': 60, 'F3': 61, 'F4': 62, 'F5': 63, 'F6': 64,
  'F7': 65, 'F8': 66, 'F9': 67, 'F10': 68, 'F11': 87, 'F12': 88
};

/**
 * Parse a hotkey string into keycodes
 * @param {string} hotkeyString - e.g., "Ctrl+Shift+A"
 * @returns {{displayString: string, keycodes: number[]}}
 */
function parseHotkey(hotkeyString) {
  const parts = hotkeyString.split('+').map(s => s.trim());
  const keycodes = [];
  const normalizedParts = [];

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (lower === 'ctrl' || lower === 'control') {
      normalizedParts.push('Ctrl');
      keycodes.push(...MODIFIER_KEYCODES.ctrl);
    } else if (lower === 'shift') {
      normalizedParts.push('Shift');
      keycodes.push(...MODIFIER_KEYCODES.shift);
    } else if (lower === 'alt') {
      normalizedParts.push('Alt');
      keycodes.push(...MODIFIER_KEYCODES.alt);
    } else if (lower === 'meta' || lower === 'win' || lower === 'cmd') {
      normalizedParts.push('Meta');
      keycodes.push(...MODIFIER_KEYCODES.meta);
    } else {
      const keyUpper = part.toUpperCase();
      normalizedParts.push(keyUpper);

      const keycode = KEY_MAP[keyUpper];
      if (keycode) {
        keycodes.push(keycode);
      }
    }
  }

  return {
    displayString: normalizedParts.join('+'),
    keycodes
  };
}

/** Modifier key names for validation */
const MODIFIER_NAMES = ['ctrl', 'control', 'shift', 'alt', 'meta', 'win', 'cmd'];
const META_NAMES = ['meta', 'win', 'cmd'];

/**
 * Check if a part is a modifier key
 * @param {string} part - Lowercase key part
 * @returns {boolean}
 */
function isModifier(part) {
  return MODIFIER_NAMES.includes(part);
}

/**
 * Validate a hotkey string
 * @param {string} hotkeyString - e.g., "Ctrl+Shift+A"
 * @returns {{valid: boolean, error: string|null}}
 */
function validateHotkey(hotkeyString) {
  const normalized = hotkeyString.split('+').map(s => s.trim()).join('+');

  if (FORBIDDEN_SHORTCUTS.includes(normalized)) {
    return {
      valid: false,
      error: 'Cannot use system shortcut. Please choose a different combination.'
    };
  }

  const parsed = parseHotkey(hotkeyString);
  const parts = hotkeyString.split('+').map(s => s.trim().toLowerCase());

  const hasModifier = parts.some(isModifier);
  if (!hasModifier) {
    return {
      valid: false,
      error: 'Hotkey must include at least one modifier key (Ctrl, Shift, Alt, or Meta).'
    };
  }

  const hasMeta = parts.some(p => META_NAMES.includes(p));
  const hasOtherModifier = parts.some(p => ['ctrl', 'control', 'shift', 'alt'].includes(p));

  if (hasMeta) {
    const nonModifierKeys = parts.filter(p => !isModifier(p));

    if (!hasOtherModifier) {
      return {
        valid: false,
        error: 'Meta key must be combined with Ctrl, Shift, or Alt.'
      };
    }

    if (nonModifierKeys.length > 0 && !nonModifierKeys.every(k => k === 'space')) {
      return {
        valid: false,
        error: 'Meta key can only be combined with modifiers and Space.'
      };
    }
  }

  if (parsed.keycodes.length === 0) {
    return {
      valid: false,
      error: 'Invalid hotkey combination.'
    };
  }

  return { valid: true, error: null };
}

/**
 * Manages global hotkey detection and callbacks
 */
class HotkeyManager {
  /**
   * @param {string} shortcut - Hotkey string (e.g., "Ctrl+Shift")
   * @param {Function} onPress - Callback when hotkey is pressed
   * @param {Function} onRelease - Callback when hotkey is released
   * @param {boolean} [toggleMode=false] - Whether to use toggle mode
   */
  constructor(shortcut, onPress, onRelease, toggleMode = false) {
    this.shortcut = shortcut;
    this.onPress = onPress;
    this.onRelease = onRelease;
    this.toggleMode = toggleMode;

    const parsed = parseHotkey(shortcut);
    this.keycodes = parsed.keycodes;

    this.keysCurrentlyPressed = new Set();
    this.isRecording = false;
    this.isToggledOn = false;
    this.hotkeyWasPressed = false;

    this._keydownHandler = this._handleKeydown.bind(this);
    this._keyupHandler = this._handleKeyup.bind(this);

    this.register();
  }

  /**
   * Registers the global keyboard hooks
   */
  register() {
    uIOhook.on('keydown', this._keydownHandler);
    uIOhook.on('keyup', this._keyupHandler);
    uIOhook.start();
    console.log('Global shortcut registered:', this.shortcut);
  }

  /**
   * Handles keydown events
   * @private
   */
  _handleKeydown(e) {
    this.keysCurrentlyPressed.add(e.keycode);
    this._checkCombo();
  }

  /**
   * Handles keyup events
   * @private
   */
  _handleKeyup(e) {
    this.keysCurrentlyPressed.delete(e.keycode);
    this._checkCombo();
  }

  /**
   * Checks if the hotkey combination is currently pressed
   * @private
   */
  _checkCombo() {
    const matchesHotkey = this._isHotkeyPressed();

    if (this.toggleMode) {
      this._handleToggleMode(matchesHotkey);
    } else {
      this._handleHoldMode(matchesHotkey);
    }
  }

  /**
   * Handles toggle mode behavior
   * @private
   */
  _handleToggleMode(matchesHotkey) {
    if (matchesHotkey && !this.hotkeyWasPressed) {
      this.hotkeyWasPressed = true;

      if (!this.isToggledOn) {
        this.isToggledOn = true;
        this.isRecording = true;
        console.log('Toggle mode: Recording started');
        this.onPress();
      } else {
        this.isToggledOn = false;
        this.isRecording = false;
        console.log('Toggle mode: Recording stopped');
        this.onRelease();
      }
    } else if (!matchesHotkey && this.hotkeyWasPressed) {
      this.hotkeyWasPressed = false;
    }
  }

  /**
   * Handles hold mode behavior
   * @private
   */
  _handleHoldMode(matchesHotkey) {
    if (matchesHotkey && !this.isRecording) {
      this.isRecording = true;
      console.log('Hold mode: Recording started');
      this.onPress();
    } else if (!matchesHotkey && this.isRecording) {
      this.isRecording = false;
      console.log('Hold mode: Recording stopped');
      this.onRelease();
    }
  }

  /**
   * Determines the key type from a keycode
   * @private
   */
  _getKeyType(keycode) {
    if (MODIFIER_KEYCODES.ctrl.includes(keycode)) return 'ctrl';
    if (MODIFIER_KEYCODES.shift.includes(keycode)) return 'shift';
    if (MODIFIER_KEYCODES.alt.includes(keycode)) return 'alt';
    if (MODIFIER_KEYCODES.meta.includes(keycode)) return 'meta';
    return keycode;
  }

  /**
   * Checks if all required keys for the hotkey are pressed
   * @private
   * @returns {boolean}
   */
  _isHotkeyPressed() {
    if (this.keysCurrentlyPressed.size === 0 || this.keycodes.length === 0) {
      return false;
    }

    const pressedKeyTypes = new Set();
    const expectedKeyTypes = new Set();

    for (const keycode of this.keycodes) {
      expectedKeyTypes.add(this._getKeyType(keycode));

      if (this.keysCurrentlyPressed.has(keycode)) {
        pressedKeyTypes.add(this._getKeyType(keycode));
      }
    }

    return pressedKeyTypes.size === expectedKeyTypes.size &&
      [...expectedKeyTypes].every(key => pressedKeyTypes.has(key));
  }

  /**
   * Unregisters the global keyboard hooks
   */
  unregister() {
    uIOhook.stop();
  }

  /**
   * Updates the hotkey shortcut
   * @param {string} newShortcut - New hotkey string
   */
  updateShortcut(newShortcut) {
    const parsed = parseHotkey(newShortcut);
    this.shortcut = parsed.displayString;
    this.keycodes = parsed.keycodes;
    this._resetState();
    console.log('Hotkey updated to:', this.shortcut);
  }

  /**
   * Sets toggle mode on or off
   * @param {boolean} enabled - Whether to enable toggle mode
   */
  setToggleMode(enabled) {
    this.toggleMode = enabled;
    this._resetState();
    console.log('Toggle mode:', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Resets internal state
   * @private
   */
  _resetState() {
    this.keysCurrentlyPressed.clear();
    this.isRecording = false;
    this.isToggledOn = false;
    this.hotkeyWasPressed = false;
  }
}

module.exports = HotkeyManager;
module.exports.parseHotkey = parseHotkey;
module.exports.validateHotkey = validateHotkey;
