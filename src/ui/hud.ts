export interface Hud {
  update(speedKmh: number, offRoad: boolean): void;
  showMessage(text: string, durationMs?: number): void;
  /** Shows or hides the "AUTODRIVE" badge. */
  setAuto(active: boolean): void;
  setGear(gear: number): void;
  /** Shows or hides the "DRS" badge. */
  setDrs(open: boolean, available: boolean, requested?: boolean): void;
  dispose(): void;
}

function query(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`HUD element not found: ${selector}`);
  return element;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="hud-speed">
      <span class="hud-speed-value">0</span>
      <span class="hud-speed-unit">km/h</span>
    </div>
    <div class="hud-controls">
      <div class="hud-title">Controls</div>
      <div><kbd>W</kbd> <kbd>&uarr;</kbd> Accelerate</div>
      <div><kbd>S</kbd> <kbd>&darr;</kbd> Brake / reverse</div>
      <div><kbd>A</kbd> <kbd>D</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> Steer</div>
      <div><kbd>R</kbd> Reset car</div>
      <div><kbd>E</kbd> Autodrive on / off</div>
      <div><kbd>C</kbd> Camera view</div>
      <div><kbd>LEFT SHIFT</kbd> Toggle DRS</div>
    </div>
    <div class="hud-offroad">Off road &mdash; press <kbd>R</kbd> to reset</div>
    <div class="hud-message"></div>
    <div class="hud-gear"></div>
    <div class="hud-drs">DRS</div>
    <div class="hud-auto">AUTODRIVE &mdash; press any key to take over</div>
  `;
  container.appendChild(root);

  const speedValue = query(root, '.hud-speed-value');
  const offRoadElement = query(root, '.hud-offroad');
  const messageElement = query(root, '.hud-message');
  const autoElement = query(root, '.hud-auto');
  const gearElement = query(root, '.hud-gear');
  gearElement.style.cssText =
    'position:absolute;right:30px;bottom:92px;font-size:20px;font-weight:700;letter-spacing:0.06em;opacity:0.9;';
  const drsElement = query(root, '.hud-drs');
  drsElement.style.cssText =
    'position:absolute;right:30px;bottom:122px;padding:2px 10px;border-radius:6px;background:rgba(30,160,90,0.9);' +
    'font-size:16px;font-weight:700;letter-spacing:0.08em;opacity:0;transition:opacity 0.15s ease;text-shadow:none;';
  let lastGear = 0;

  // The badge is styled here (not in style.css) so the stylesheet does not need to change.
  autoElement.style.cssText =
    'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 18px;' +
    'border-radius:999px;background:rgba(30,140,80,0.85);font-size:15px;font-weight:700;' +
    'letter-spacing:0.04em;opacity:0;transition:opacity 0.25s ease;text-shadow:none;';

  let lastSpeed = -1;
  let lastOffRoad = false;
  let messageTimer = 0;

  return {
    update(speedKmh: number, offRoad: boolean): void {
      const rounded = Math.round(speedKmh);
      if (rounded !== lastSpeed) {
        lastSpeed = rounded;
        speedValue.textContent = String(rounded);
      }
      if (offRoad !== lastOffRoad) {
        lastOffRoad = offRoad;
        offRoadElement.classList.toggle('visible', offRoad);
      }
    },

    showMessage(text: string, durationMs = 1800): void {
      if (!text) return;
      messageElement.textContent = text;
      messageElement.classList.add('visible');
      window.clearTimeout(messageTimer);
      messageTimer = window.setTimeout(() => {
        messageElement.classList.remove('visible');
      }, durationMs);
    },

    setDrs(open: boolean, available: boolean, requested = false): void {
      drsElement.style.opacity = available || requested ? '1' : '0';
      drsElement.textContent = open ? 'DRS OPEN' : requested ? 'DRS ARMED' : available ? 'DRS READY · LEFT SHIFT' : 'DRS';
      drsElement.style.background = open ? 'rgba(30,160,90,0.95)' : requested ? 'rgba(160,95,35,0.95)' : 'rgba(45,105,155,0.9)';
    },

    setGear(gear: number): void {
      if (gear === lastGear) return;
      lastGear = gear;
      gearElement.textContent = `GEAR ${gear}`;
    },

    setAuto(active: boolean): void {
      autoElement.style.opacity = active ? '1' : '0';
    },

    dispose(): void {
      window.clearTimeout(messageTimer);
      root.remove();
    },
  };
}