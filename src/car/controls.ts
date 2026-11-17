import { AUTODRIVE } from '../config';
import type { VehicleInput } from '../types';

export interface Controls {
  read(): VehicleInput;
  /** Returns true once per press of R. */
  consumeReset(): boolean;
  /** Returns true once per press of the autodrive key (E). */
  consumeAutoToggle(): boolean;
  /** Returns true once per press of the camera key (C). Does not hand control back from autodrive. */
  consumeCameraToggle(): boolean;
  /** Returns true once per press of Left Shift to toggle manual DRS. */
  consumeDrsToggle(): boolean;
  /**
   * Returns true once if any key other than the autodrive key was newly pressed since the last
   * call. Used to hand control back to the driver while autodrive is on. Modifier keys, browser
   * shortcuts (Ctrl/Cmd/Alt + key) and the debug-overlay keys do not count.
   */
  consumeAnyKey(): boolean;
  dispose(): void;
}

const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyR',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/** Keys that only change what the debug overlay shows; they must not cancel autodrive. */
const DEBUG_KEYS = new Set([
  'KeyV',
  'KeyF',
  'KeyG',
  'KeyP',
  'Equal',
  'Minus',
  'NumpadAdd',
  'NumpadSubtract',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
]);

const MODIFIER_KEYS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

export function createControls(target: Window = window): Controls {
  const down = new Set<string>();
  let resetRequested = false;
  let autoToggleRequested = false;
  let cameraToggleRequested = false;
  let drsToggleRequested = false;
  let anyKeyPressed = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return; // leave browser shortcuts alone

    if (event.code === AUTODRIVE.toggleKey) {
      event.preventDefault();
      if (!event.repeat) autoToggleRequested = true;
      return;
    }

    if (event.code === 'ShiftLeft') {
      event.preventDefault();
      if (!event.repeat) drsToggleRequested = true;
      return;
    }

    if (event.code === 'KeyC') {
      event.preventDefault();
      if (!event.repeat) cameraToggleRequested = true;
      return;
    }

    // Any other newly pressed key (not a held-down repeat) hands control back to the driver.
    if (!event.repeat && event.code !== 'Space' && !MODIFIER_KEYS.has(event.code) && !DEBUG_KEYS.has(event.code)) {
      anyKeyPressed = true;
    }

    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault(); // stops arrow keys from scrolling the page
    if (event.repeat) return;
    if (event.code === 'KeyR') {
      resetRequested = true;
      return;
    }
    down.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    down.delete(event.code);
  };

  // If the window loses focus, keys would stay "stuck" down, so clear them.
  const onBlur = (): void => {
    down.clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    read(): VehicleInput {
      const left = down.has('KeyA') || down.has('ArrowLeft');
      const right = down.has('KeyD') || down.has('ArrowRight');
      return {
        throttle: down.has('KeyW') || down.has('ArrowUp') ? 1 : 0,
        brake: down.has('KeyS') || down.has('ArrowDown') ? 1 : 0,
        steer: (left ? 1 : 0) - (right ? 1 : 0),
      };
    },
    consumeReset(): boolean {
      const requested = resetRequested;
      resetRequested = false;
      return requested;
    },
    consumeAutoToggle(): boolean {
      const requested = autoToggleRequested;
      autoToggleRequested = false;
      return requested;
    },
    consumeCameraToggle(): boolean {
      const requested = cameraToggleRequested;
      cameraToggleRequested = false;
      return requested;
    },
    consumeDrsToggle(): boolean {
      const requested = drsToggleRequested;
      drsToggleRequested = false;
      return requested;
    },
    consumeAnyKey(): boolean {
      const pressed = anyKeyPressed;
      anyKeyPressed = false;
      return pressed;
    },
    dispose(): void {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
    },
  };
}