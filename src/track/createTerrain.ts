import * as THREE from 'three';
import { TRACK } from '../config';
import { smoothstep } from '../utils/math';

/** Smooth rolling hill pattern, 0..1. Made from a few sine waves (same pattern as Stage 1). */
function hillShape(x: number, z: number): number {
  const raw =
    22 * Math.sin(x * 0.0021 + 1.3) * Math.cos(z * 0.0017 + 0.4) +
    12 * Math.sin(x * 0.0047 + z * 0.0039 + 2.1) +
    5 * Math.sin(x * 0.011 - z * 0.009 + 0.7);
  return (raw / 39 + 1) / 2;
}

/**
 * Ground height at a world position: perfectly flat near the road, rolling hills further out.
 * `distanceToRoad(x, z, max)` must return Infinity when the road is further than `max`.
 */
export function createHeightFunction(
  distanceToRoad: (x: number, z: number, maxDistance: number) => number,
): (x: number, z: number) => number {
  return (x: number, z: number): number => {
    const distance = distanceToRoad(x, z, TRACK.hillFadeDistance);
    const mask = smoothstep(TRACK.flatRadius, TRACK.hillFadeDistance, distance); // Infinity -> 1
    if (mask <= 0) return 0;
    return hillShape(x, z) * TRACK.hillHeight * mask;
  };
}

/** Builds the grass terrain mesh centred on (centerX, centerZ). */
export function createTerrain(
  centerX: number,
  centerZ: number,
  heightAt: (x: number, z: number) => number,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(
    TRACK.terrainSize,
    TRACK.terrainSize,
    TRACK.terrainSegments,
    TRACK.terrainSegments,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(centerX, 0, centerZ);

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
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
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  return terrain;
}