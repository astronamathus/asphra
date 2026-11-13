import * as THREE from 'three';
import { TRACK } from '../config';
import type { TrackData } from '../types';
import { smoothstep } from '../utils/math';

interface RibbonBuilder {
  positions: number[];
  indices: number[];
}

/**
 * Adds a flat strip that follows a list of points.
 * `offset` shifts the strip sideways from the centerline (positive = left).
 */
function pushRibbon(
  builder: RibbonBuilder,
  points: THREE.Vector3[],
  tangents: THREE.Vector3[],
  offset: number,
  halfWidth: number,
  y: number,
): void {
  const base = builder.positions.length / 3;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const t = tangents[i];
    const leftX = t.z; // left of travel direction
    const leftZ = -t.x;
    const a = offset + halfWidth;
    const b = offset - halfWidth;
    builder.positions.push(p.x + leftX * a, y, p.z + leftZ * a); // left vertex
    builder.positions.push(p.x + leftX * b, y, p.z + leftZ * b); // right vertex
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = base + i * 2;
    builder.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

function toGeometry(builder: RibbonBuilder): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
  geometry.setIndex(builder.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Smooth rolling hill pattern, 0..1. Made from a few sine waves (no noise library needed). */
function hillShape(x: number, z: number): number {
  const raw =
    22 * Math.sin(x * 0.0021 + 1.3) * Math.cos(z * 0.0017 + 0.4) +
    12 * Math.sin(x * 0.0047 + z * 0.0039 + 2.1) +
    5 * Math.sin(x * 0.011 - z * 0.009 + 0.7);
  return (raw / 39 + 1) / 2;
}

export function createTestTrack(): TrackData {
  const group = new THREE.Group();

  // --- Centerline ---
  const curve = new THREE.CatmullRomCurve3(
    TRACK.controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  );
  const length = curve.getLength();
  const divisions = Math.max(2, Math.ceil(length / TRACK.sampleSpacing));
  const samples = curve.getSpacedPoints(divisions);

  const tangents = samples.map((_, i) => {
    const before = samples[Math.max(i - 1, 0)];
    const after = samples[Math.min(i + 1, samples.length - 1)];
    return new THREE.Vector3().subVectors(after, before).setY(0).normalize();
  });

  const px = new Float32Array(samples.length);
  const pz = new Float32Array(samples.length);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  samples.forEach((p, i) => {
    px[i] = p.x;
    pz[i] = p.z;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  });
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };

  function distanceToCenterline(x: number, z: number): number {
    let best = Infinity;
    for (let i = 0; i < px.length - 1; i++) {
      const ax = px[i];
      const az = pz[i];
      const abx = px[i + 1] - ax;
      const abz = pz[i + 1] - az;
      let t = ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + abx * t);
      const dz = z - (az + abz * t);
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  function heightAt(x: number, z: number): number {
    const mask = smoothstep(TRACK.flatRadius, TRACK.hillFadeDistance, distanceToCenterline(x, z));
    if (mask <= 0) return 0;
    return hillShape(x, z) * TRACK.hillHeight * mask;
  }

  // --- Terrain ---
  const terrainGeometry = new THREE.PlaneGeometry(
    TRACK.terrainSize,
    TRACK.terrainSize,
    TRACK.terrainSegments,
    TRACK.terrainSegments,
  );
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.translate(center.x, 0, center.z);

  const positions = terrainGeometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const grassLow = new THREE.Color(0x5e9b3e);
  const grassHigh = new THREE.Color(0x4a8233);
  const tmp = new THREE.Color();

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = heightAt(x, z);
    positions.setY(i, h - TRACK.terrainSink);

    const tint = 0.94 + 0.06 * Math.sin(x * 0.045) * Math.sin(z * 0.038);
    tmp.copy(grassLow).lerp(grassHigh, Math.min(1, h / TRACK.hillHeight)).multiplyScalar(tint);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- Road surface ---
  const roadBuilder: RibbonBuilder = { positions: [], indices: [] };
  pushRibbon(roadBuilder, samples, tangents, 0, TRACK.roadWidth / 2, 0);
  const road = new THREE.Mesh(
    toGeometry(roadBuilder),
    new THREE.MeshStandardMaterial({
      color: 0x44474c,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  road.receiveShadow = true;
  group.add(road);

  // --- Road markings: solid edge lines and a dashed centre line ---
  const markingBuilder: RibbonBuilder = { positions: [], indices: [] };
  const edgeOffset = TRACK.roadWidth / 2 - TRACK.edgeLineInset;
  pushRibbon(markingBuilder, samples, tangents, edgeOffset, TRACK.lineWidth / 2, 0.02);
  pushRibbon(markingBuilder, samples, tangents, -edgeOffset, TRACK.lineWidth / 2, 0.02);

  for (let s = 0; s + TRACK.dashLength < length; s += TRACK.dashLength + TRACK.dashGap) {
    const u0 = s / length;
    const u1 = (s + TRACK.dashLength) / length;
    const p0 = curve.getPointAt(u0);
    const p1 = curve.getPointAt(u1);
    const t0 = curve.getTangentAt(u0).setY(0).normalize();
    const t1 = curve.getTangentAt(u1).setY(0).normalize();
    pushRibbon(markingBuilder, [p0, p1], [t0, t1], 0, TRACK.centerLineWidth / 2, 0.02);
  }

  const markings = new THREE.Mesh(
    toGeometry(markingBuilder),
    new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  markings.receiveShadow = true;
  group.add(markings);

  // --- Start position ---
  const startU = Math.min(0.9, TRACK.startDistance / length);
  const startPoint = curve.getPointAt(startU);
  const startTangent = curve.getTangentAt(startU);
  const start = {
    x: startPoint.x,
    z: startPoint.z,
    heading: Math.atan2(startTangent.x, startTangent.z),
  };

  return {
    object: group,
    roadWidth: TRACK.roadWidth,
    start,
    center,
    samples,
    heightAt,
    distanceToCenterline,
  };
}