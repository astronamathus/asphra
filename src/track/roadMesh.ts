import * as THREE from 'three';
import { CIRCUIT } from '../config';
import type { Centerline } from './trackGeometry';

/**
 * Builds one flat strip along the whole closed centerline.
 * `leftOffset(i)` / `rightOffset(i)` give the sideways position of the strip's two edges at
 * point i, measured from the centerline (positive = left of the direction of travel).
 *
 * The strip has count + 1 cross-sections: the last one repeats the first so the texture
 * coordinate v can run on to the full lap length, while the positions meet exactly (no seam gap).
 */
function buildStrip(
  c: Centerline,
  leftOffset: (i: number) => number,
  rightOffset: (i: number) => number,
  y: number,
): THREE.BufferGeometry {
  const sections = c.count + 1;
  const positions = new Float32Array(sections * 2 * 3);
  const normals = new Float32Array(sections * 2 * 3);
  const uvs = new Float32Array(sections * 2 * 2);
  const indices = new Uint32Array(c.count * 6);

  for (let k = 0; k < sections; k++) {
    const i = k % c.count;
    const leftX = c.tz[i]; // left of the direction of travel
    const leftZ = -c.tx[i];
    const a = leftOffset(i);
    const b = rightOffset(i);
    const v = (k === c.count ? c.lapLength : c.s[i]) / CIRCUIT.uvMetersPerRepeat;

    const left = k * 2;
    const right = k * 2 + 1;
    positions.set([c.x[i] + leftX * a, y, c.z[i] + leftZ * a], left * 3);
    positions.set([c.x[i] + leftX * b, y, c.z[i] + leftZ * b], right * 3);
    normals.set([0, 1, 0], left * 3);
    normals.set([0, 1, 0], right * 3);
    uvs.set([0, v], left * 2);
    uvs.set([1, v], right * 2);
  }

  // Counter-clockwise when seen from above, so every face points up.
  for (let k = 0; k < c.count; k++) {
    const a = k * 2;
    indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k * 6);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/** Asphalt surface (full width between the source's left and right edges) plus white edge lines. */
export function createRoadMeshes(c: Centerline): THREE.Group {
  const group = new THREE.Group();
  const { edgeLineInset: inset, edgeLineWidth: lineWidth } = CIRCUIT;

  const road = new THREE.Mesh(
    buildStrip(c, (i) => c.widthLeft[i], (i) => -c.widthRight[i], CIRCUIT.roadY),
    new THREE.MeshStandardMaterial({
      color: CIRCUIT.asphaltColor,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  road.receiveShadow = true;
  group.add(road);

  const lineMaterial = new THREE.MeshStandardMaterial({
    color: CIRCUIT.lineColor,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const lineY = CIRCUIT.roadY + 0.02;

  const leftLine = new THREE.Mesh(
    buildStrip(
      c,
      (i) => c.widthLeft[i] - inset + lineWidth / 2,
      (i) => c.widthLeft[i] - inset - lineWidth / 2,
      lineY,
    ),
    lineMaterial,
  );
  const rightLine = new THREE.Mesh(
    buildStrip(
      c,
      (i) => -(c.widthRight[i] - inset) + lineWidth / 2,
      (i) => -(c.widthRight[i] - inset) - lineWidth / 2,
      lineY,
    ),
    lineMaterial,
  );
  leftLine.receiveShadow = true;
  rightLine.receiveShadow = true;
  group.add(leftLine, rightLine);

  return group;
}