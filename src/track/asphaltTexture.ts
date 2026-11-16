import * as THREE from 'three';

const SIZE = 512;

/** Small deterministic hash whose lattice repeats at the texture boundary. */
function hash(x: number, y: number, period: number): number {
  x = ((x % period) + period) % period;
  y = ((y % period) + period) % period;
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Periodic value noise: every octave tiles seamlessly in both directions. */
function valueNoise(x: number, y: number, period: number): number {
  const gx = (x / SIZE) * period;
  const gy = (y / SIZE) * period;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smooth(gx - ix);
  const fy = smooth(gy - iy);
  const a = hash(ix, iy, period);
  const b = hash(ix + 1, iy, period);
  const c = hash(ix, iy + 1, period);
  const d = hash(ix + 1, iy + 1, period);
  const top = THREE.MathUtils.lerp(a, b, fx);
  const bottom = THREE.MathUtils.lerp(c, d, fx);
  return THREE.MathUtils.lerp(top, bottom, fy) * 2 - 1;
}

/**
 * Creates a lightweight, seamless procedural asphalt aggregate texture.
 * UVs on the road mesh already repeat every CIRCUIT.uvMetersPerRepeat metres.
 */
export function createAsphaltTexture(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const fine = valueNoise(x, y, 128);
      const medium = valueNoise(x, y, 32);
      const broad = valueNoise(x, y, 8);
      const grain = hash(x, y, SIZE) * 2 - 1;

      // Near-white greys multiply the existing asphalt base colour, preserving its palette.
      // Multiple low-amplitude scales suggest aggregate without making the surface blotchy.
      let value = 246 + fine * 3.2 + medium * 2.1 + broad * 1.2 + grain * 2.0;

      // Sparse, very small aggregate flecks add detail at close range.
      const fleck = hash(x + 91, y + 173, SIZE);
      if (fleck > 0.992) value -= 8 + hash(x + 19, y + 37, SIZE) * 5;

      const pixel = (y * SIZE + x) * 4;
      const channel = THREE.MathUtils.clamp(Math.round(value), 0, 255);
      data[pixel] = channel;
      data[pixel + 1] = channel;
      data[pixel + 2] = channel;
      data[pixel + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = 'Procedural Monza asphalt aggregate';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
