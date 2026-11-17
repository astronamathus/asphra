import * as THREE from 'three';
import { CAR_SIZE } from '../config';
import type { VehicleState } from '../types';
import { clamp, damp } from '../utils/math';

const MAX_VISUAL_STEER = 0.4; // radians

export interface CarVisual {
  group: THREE.Group;
  update(dt: number, state: VehicleState, heightAt: (x: number, z: number) => number, drsOpen?: boolean): void;
  reset(): void;
}

/** A body section from its side view: points are (z along the car, y height), extruded sideways. */
function sideProfile(points: [number, number][], width: number, bevel: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(width - bevel * 2, 0.01),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2); // centre the width
  geometry.rotateY(-Math.PI / 2); // shape x (the car's z) now points forward
  return geometry;
}

/** A flat-topped part from its top view: points are (x sideways, z along the car), extruded upwards. */
function topPrism(points: [number, number][], height: number, baseY: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // the shape's y becomes -z after the rotation below, so it is given as -z here
  shape.moveTo(points[0][0], -points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], -points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, baseY, 0);
  return geometry;
}

export function createCar(): CarVisual {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const paint = new THREE.MeshStandardMaterial({ color: 0xd01b1b, roughness: 0.35, metalness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.4, metalness: 0.1 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55, metalness: 0.2 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.3, metalness: 0.8 });
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0xf2cf1d, roughness: 0.3, metalness: 0.2 });

  function add(mesh: THREE.Mesh, x = 0, y = 0, z = 0): THREE.Mesh {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh =>
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y, z);

  /** A thin round bar between two points (suspension arms, halo). */
  function bar(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material = carbon): void {
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    group.add(mesh);
  }

  // ---- Floor and diffuser ----
  box(1.5, 0.03, 4.5, carbon, 0, 0.09, -0.05);
  box(0.95, 0.14, 0.45, carbon, 0, 0.17, -2.3);

  // ---- Monocoque and engine cover (side view), cockpit opening, airbox ----
  add(
    new THREE.Mesh(
      sideProfile(
        [
          [0.7, 0.14],
          [0.7, 0.4],
          [0.35, 0.56],
          [0.0, 0.62],
          [-0.4, 0.62],
          [-0.8, 0.7],
          [-1.2, 0.8],
          [-1.7, 0.62],
          [-2.2, 0.38],
          [-2.3, 0.14],
        ],
        0.52,
        0.05,
      ),
      paint,
    ),
  );
  box(0.34, 0.08, 0.55, carbon, 0, 0.635, -0.1); // cockpit opening
  box(0.28, 0.27, 0.5, paint, 0, 0.86, -0.55); // airbox
  box(0.22, 0.2, 0.06, carbon, 0, 0.88, -0.28); // airbox inlet

  // ---- Nose cone ----
  const nose = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.19, 1.9, 14), paint), 0, 0.27, 1.65);
  nose.rotation.x = Math.PI / 2; // the narrow end points forward
  nose.scale.set(1, 1, 0.7);
  const noseTip = add(new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.07, 0.25, 12), white), 0, 0.27, 2.48);
  noseTip.rotation.x = Math.PI / 2;
  noseTip.scale.set(1, 1, 0.7);

  // ---- Front wing ----
  box(1.9, 0.03, 0.4, carbon, 0, 0.1, 2.55);
  box(1.9, 0.025, 0.22, white, 0, 0.15, 2.5);
  for (const side of [-1, 1]) box(0.03, 0.2, 0.5, white, side * 0.95, 0.17, 2.52);

  // ---- Sidepods (top view, mirrored) ----
  const pod: [number, number][] = [
    [0.26, 0.55],
    [0.55, 0.45],
    [0.64, 0.0],
    [0.62, -0.9],
    [0.45, -1.7],
    [0.3, -1.95],
    [0.26, -1.2],
  ];
  add(new THREE.Mesh(topPrism(pod, 0.34, 0.16), paint));
  add(new THREE.Mesh(topPrism(pod.map(([x, z]) => [-x, z] as [number, number]), 0.34, 0.16), paint));
  for (const side of [-1, 1]) box(0.34, 0.22, 0.04, carbon, side * 0.45, 0.31, 0.5); // sidepod inlets

  // ---- Rear wing and movable DRS flap ----
  box(0.95, 0.03, 0.36, carbon, 0, 0.97, -2.5);
  for (const side of [-1, 1]) box(0.025, 0.4, 0.6, white, side * 0.49, 0.86, -2.52);
  box(0.05, 0.5, 0.14, carbon, 0, 0.72, -2.35);
  // The flap pivots along its front edge. DRS flattens its angle to reduce drag.
  const drsFlapPivot = new THREE.Group();
  drsFlapPivot.position.set(0, 1.045, -2.42);
  group.add(drsFlapPivot);
  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.025, 0.22), white);
  drsFlap.position.z = -0.105;
  drsFlap.castShadow = true;
  drsFlapPivot.add(drsFlap);
  let drsFlapAngle = 0.2;

  // ---- Halo, helmet ----
  for (const side of [-1, 1]) {
    bar(new THREE.Vector3(side * 0.2, 0.62, -0.35), new THREE.Vector3(side * 0.05, 0.8, 0.42), 0.017);
    bar(new THREE.Vector3(side * 0.05, 0.8, 0.42), new THREE.Vector3(0, 0.58, 0.55), 0.017);
  }
  bar(new THREE.Vector3(-0.05, 0.8, 0.42), new THREE.Vector3(0.05, 0.8, 0.42), 0.017);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), helmetMaterial), 0, 0.7, -0.2);

  // ---- Wheels and suspension ----
  const frontPivots: THREE.Group[] = [];
  const spins: { group: THREE.Group; radius: number }[] = [];

  function addWheel(x: number, z: number, spec: { width: number; radius: number }, steerable: boolean): void {
    const pivot = new THREE.Group();
    pivot.position.set(x, spec.radius, z);
    const spin = new THREE.Group();
    pivot.add(spin);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius, spec.radius, spec.width, 24), tyre);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius * 0.62, spec.radius * 0.62, spec.width + 0.01, 16), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    const barA = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.012, 0.05, spec.radius * 1.15), carbon);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.012, spec.radius * 1.15, 0.05), carbon);
    spin.add(tire, rim, barA, barB);
    group.add(pivot);
    spins.push({ group: spin, radius: spec.radius });
    if (steerable) frontPivots.push(pivot);

    // two suspension arms from the wheel hub to the body
    const sign = Math.sign(x);
    const hub = new THREE.Vector3(sign * (Math.abs(x) - spec.width / 2), spec.radius, z);
    bar(hub, new THREE.Vector3(sign * 0.22, 0.2, z - 0.25), 0.012);
    bar(hub, new THREE.Vector3(sign * 0.22, 0.24, z + 0.25), 0.012);
  }
  const { front, rear } = CAR_SIZE;
  addWheel(front.x, front.z, front, true);
  addWheel(-front.x, front.z, front, true);
  addWheel(rear.x, -rear.z, rear, false);
  addWheel(-rear.x, -rear.z, rear, false);

  // ---- Animation (the car follows the ground, leans with acceleration and cornering) ----
  let previousLongSpeed = 0;
  let dynamicPitch = 0;
  let dynamicRoll = 0;

  function update(dt: number, state: VehicleState, heightAt: (x: number, z: number) => number, drsOpen = false): void {
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const wx = CAR_SIZE.wheelX;
    const wz = CAR_SIZE.wheelZ;

    // Ground height under each wheel (local x = left, local z = forward).
    const at = (lx: number, lz: number): number => heightAt(state.x + lx * cosH + lz * sinH, state.z - lx * sinH + lz * cosH);
    const frontLeft = at(wx, wz);
    const frontRight = at(-wx, wz);
    const rearLeft = at(wx, -wz);
    const rearRight = at(-wx, -wz);

    const y = (frontLeft + frontRight + rearLeft + rearRight) / 4;
    const terrainPitch = -Math.atan2((frontLeft + frontRight) / 2 - (rearLeft + rearRight) / 2, wz * 2);
    const terrainRoll = Math.atan2((frontLeft + rearLeft) / 2 - (frontRight + rearRight) / 2, wx * 2);

    if (dt > 0) {
      const longAccel = (state.longSpeed - previousLongSpeed) / dt;
      const lateralAccel = state.yawRate * state.longSpeed;
      dynamicPitch = damp(dynamicPitch, -clamp(longAccel, -30, 30) * 0.0012, 8, dt);
      dynamicRoll = damp(dynamicRoll, clamp(lateralAccel, -40, 40) * 0.0008, 8, dt);
      for (const spin of spins) spin.group.rotation.x += (state.longSpeed * dt) / spin.radius;
      drsFlapAngle = damp(drsFlapAngle, drsOpen ? 0.015 : 0.2, 9, dt);
    }
    previousLongSpeed = state.longSpeed;
    drsFlapPivot.rotation.x = drsFlapAngle;

    for (const pivot of frontPivots) pivot.rotation.y = state.steer * MAX_VISUAL_STEER;

    group.position.set(state.x, y, state.z);
    group.rotation.set(terrainPitch + dynamicPitch, state.heading, terrainRoll + dynamicRoll);
  }

  function reset(): void {
    previousLongSpeed = 0;
    dynamicPitch = 0;
    dynamicRoll = 0;
  }

  return { group, update, reset };
}