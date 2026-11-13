import * as THREE from 'three';
import { WORLD } from '../config';
import type { TrackData } from '../types';
import { lerp } from '../utils/math';

/** Small deterministic random generator so the scenery looks the same every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScenery(track: TrackData): THREE.Group {
  const rand = mulberry32(20240607);
  const group = new THREE.Group();

  // --- Distant mountains in a ring around the track ---
  const mountainGeometry = new THREE.ConeGeometry(1, 1, 7, 1);
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x7d97ab,
    roughness: 1,
    flatShading: true,
  });

  for (let i = 0; i < WORLD.mountainCount; i++) {
    const angle = ((i + rand() * 0.8) / WORLD.mountainCount) * Math.PI * 2;
    const ring = lerp(WORLD.mountainRingMin, WORLD.mountainRingMax, rand());
    const radius = lerp(160, 340, rand());
    const height = lerp(90, 240, rand());

    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountain.position.set(
      track.center.x + Math.cos(angle) * ring,
      height / 2 - 8,
      track.center.z + Math.sin(angle) * ring,
    );
    mountain.scale.set(radius, height, radius * lerp(0.7, 1.2, rand()));
    mountain.rotation.y = rand() * Math.PI;
    group.add(mountain);
  }

  // --- Trees (two instanced meshes: trunks and foliage) ---
  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.3, 2, 6);
  trunkGeometry.translate(0, 1, 0);
  const foliageGeometry = new THREE.ConeGeometry(2.2, 6, 7);
  foliageGeometry.translate(0, 5, 0);

  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 1 }),
    WORLD.treeCount,
  );
  const foliage = new THREE.InstancedMesh(
    foliageGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    WORLD.treeCount,
  );
  trunks.frustumCulled = false;
  foliage.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  let attempts = 0;

  while (placed < WORLD.treeCount && attempts < WORLD.treeCount * 25) {
    attempts++;
    const base = track.samples[Math.floor(rand() * track.samples.length)];
    const angle = rand() * Math.PI * 2;
    const distance = 28 + Math.pow(rand(), 1.5) * 380;
    const x = base.x + Math.cos(angle) * distance;
    const z = base.z + Math.sin(angle) * distance;

    // Keep the road corridor clear, and leave some open meadows.
    if (track.distanceToCenterline(x, z) < 26) continue;
    if (Math.sin(x * 0.004) * Math.sin(z * 0.005 + 1) < -0.2) continue;

    const scale = lerp(0.8, 1.7, rand());
    dummy.position.set(x, track.heightAt(x, z), z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(placed, dummy.matrix);
    foliage.setMatrixAt(placed, dummy.matrix);
    color.setRGB(0.12 + rand() * 0.08, 0.34 + rand() * 0.14, 0.14 + rand() * 0.06, THREE.SRGBColorSpace);
    foliage.setColorAt(placed, color);
    placed++;
  }

  trunks.count = placed;
  foliage.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;

  group.add(trunks, foliage);
  return group;
}