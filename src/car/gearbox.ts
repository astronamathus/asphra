import { GEARBOX } from '../config';

export interface Gearbox {
  /** Returns the gear (1-8) for the current speed, with hysteresis so it does not flicker. */
  update(speedKmh: number): number;
}

/** Display-only gearbox: the shift speeds come from the onboard video (see GEARBOX in config.ts). */
export function createGearbox(): Gearbox {
  let gear = 1;
  return {
    update(speedKmh: number): number {
      while (gear < 8 && speedKmh >= GEARBOX.upshiftKmh[gear - 1]) gear++;
      while (gear > 1 && speedKmh < GEARBOX.downshiftKmh[gear - 2]) gear--;
      return gear;
    },
  };
}