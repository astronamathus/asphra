import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

/** A faceted, tapered monocoque/nose loft. Sections are [z, halfWidth, bottomY, topY]. */
function taperedBody(sections: [number, number, number, number][]): THREE.BufferGeometry {
  const ring = (w: number, bottom: number, top: number): [number, number][] => [
    [-w * 0.62, bottom],
    [-w, bottom + (top - bottom) * 0.18],
    [-w, top - (top - bottom) * 0.18],
    [-w * 0.62, top],
    [w * 0.62, top],
    [w, top - (top - bottom) * 0.18],
    [w, bottom + (top - bottom) * 0.18],
    [w * 0.62, bottom],
  ];
  const vertices: number[] = [];
  for (const [z, width, bottom, top] of sections) {
    for (const [x, y] of ring(width, bottom, top)) vertices.push(x, y, z);
  }
  const indices: number[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j;
      const b = i * 8 + (j + 1) % 8;
      const c = (i + 1) * 8 + (j + 1) % 8;
      const d = (i + 1) * 8 + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
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

  // ---- Floor, stepped side edges and rear diffuser ----
  box(1.5, 0.045, 4.5, carbon, 0, 0.09, -0.05);
  box(0.95, 0.14, 0.45, carbon, 0, 0.17, -2.3);
  for (const side of [-1, 1]) {
    box(0.055, 0.11, 3.55, carbon, side * 0.73, 0.17, -0.12);
    box(0.12, 0.025, 0.58, white, side * 0.64, 0.13, -1.62);
  }
  // Diffuser channels are visible from low chase angles without adding heavy geometry.
  for (let i = -2; i <= 2; i++) {
    box(0.018, 0.16, 0.42, carbon, i * 0.16, 0.19, -2.28);
  }

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
  // Recessed cockpit with a raised carbon rim and compact roll-hoop / airbox.
  box(0.39, 0.055, 0.62, carbon, 0, 0.64, -0.12);
  box(0.30, 0.025, 0.49, carbon, 0, 0.68, -0.12);
  box(0.28, 0.27, 0.5, paint, 0, 0.86, -0.55); // engine cover / airbox
  box(0.22, 0.2, 0.06, carbon, 0, 0.88, -0.28); // airbox inlet
  box(0.09, 0.035, 0.12, carbon, 0, 1.015, -0.55); // T-cam housing
  box(0.035, 0.025, 0.08, white, 0, 1.038, -0.55); // camera lens housing

  // ---- Tapered monocoque nose ----
  // A faceted loft gives the nose a broad shoulder at the chassis and a narrow,
  // low tip instead of the old cylindrical placeholder.
  const noseMaterial = paint.clone();
  noseMaterial.side = THREE.DoubleSide;
  add(new THREE.Mesh(taperedBody([
    [2.78, 0.055, 0.205, 0.265],
    [2.48, 0.085, 0.19, 0.315],
    [2.12, 0.115, 0.175, 0.365],
    [1.72, 0.155, 0.16, 0.425],
    [1.28, 0.205, 0.15, 0.50],
    [0.78, 0.265, 0.15, 0.585],
    [0.48, 0.30, 0.15, 0.625],
  ]), noseMaterial));

  // ---- Multi-element front wing and sculpted endplates ----
  box(1.92, 0.035, 0.43, carbon, 0, 0.105, 2.53); // mainplane
  box(1.82, 0.028, 0.30, white, 0, 0.15, 2.48); // leading flap
  box(1.68, 0.024, 0.22, paint, 0, 0.195, 2.38); // upper flap
  box(1.48, 0.018, 0.14, carbon, 0, 0.225, 2.29); // flap trailing edge
  for (const side of [-1, 1]) {
    box(0.035, 0.24, 0.52, white, side * 0.96, 0.19, 2.51);
    box(0.025, 0.13, 0.30, carbon, side * 0.90, 0.30, 2.43);
    box(0.12, 0.055, 0.30, paint, side * 0.72, 0.18, 2.45);
  }

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
  for (const side of [-1, 1]) {
    box(0.34, 0.22, 0.04, carbon, side * 0.45, 0.31, 0.5); // deep inlet
    box(0.29, 0.035, 0.035, white, side * 0.45, 0.40, 0.48); // inlet upper lip
    box(0.34, 0.035, 0.72, carbon, side * 0.49, 0.13, -0.82); // undercut / floor edge
    box(0.025, 0.018, 0.92, white, side * 0.64, 0.505, -0.68); // sidepod highlight
  }

  // ---- Rear wing: fixed mainplane and independently hinged upper DRS flap ----
  box(1.02, 0.035, 0.34, carbon, 0, 0.965, -2.51);
  for (const side of [-1, 1]) {
    box(0.035, 0.43, 0.58, white, side * 0.50, 0.88, -2.52);
    box(0.018, 0.23, 0.34, carbon, side * 0.522, 0.91, -2.48);
    box(0.045, 0.38, 0.11, carbon, side * 0.30, 0.76, -2.38);
  }
  box(0.055, 0.48, 0.15, carbon, 0, 0.72, -2.34);
  box(0.82, 0.025, 0.12, white, 0, 0.60, -2.30);

  // The upper element is a shaped airfoil, not a rectangular block. Its leading
  // edge is the hinge axis; the mainplane and endplates remain fixed.
  const drsFlapPivot = new THREE.Group();
  drsFlapPivot.position.set(0, 0.91, -2.48);
  group.add(drsFlapPivot);
  const flapGeometry = sideProfile([
    [0.015, 0.006],
    [-0.055, 0.060],
    [-0.19, 0.078],
    [-0.31, 0.052],
    [-0.35, 0.020],
    [-0.29, -0.002],
    [-0.08, -0.012],
  ], 0.94, 0.006);
  const drsFlap = new THREE.Mesh(flapGeometry, white);
  drsFlap.castShadow = true;
  drsFlapPivot.add(drsFlap);

  // Small hinge caps at the ends make the flap's rotation legible in close views.
  for (const side of [-1, 1]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.055, 8), rimMaterial);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(side * 0.465, 0.0, -0.005);
    drsFlapPivot.add(hinge);
  }
  // Load the user's supplied low-poly Formula car. The public asset is a game-oriented
  // red/black GLB; keep the procedural DRS flap as a separate animated overlay because
  // the source GLB is a static mesh export with no articulated DRS node or animation.
  const drsFlapMaterial = new THREE.MeshStandardMaterial({ color: 0xb90f20, roughness: 0.38, metalness: 0.24 });
  drsFlap.material = drsFlapMaterial;
  const modelLoader = new GLTFLoader();
  modelLoader.load(
    `${import.meta.env.BASE_URL}models/F1-low-poly-red.glb`,
    (gltf) => {
      // Retain only the independently animated flap from the procedural prototype.
      for (const child of group.children) {
        if (child !== drsFlapPivot) child.visible = false;
      }
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      group.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.warn('[car] Could not load /models/F1-low-poly-red.glb; using procedural fallback.', error);
    },
  );

  const DRS_CLOSED_ANGLE = 0.17;
  const DRS_OPEN_ANGLE = -0.24;
  let drsFlapAngle = DRS_CLOSED_ANGLE;

  // ---- Halo, driver helmet and cockpit details ----
  for (const side of [-1, 1]) {
    bar(new THREE.Vector3(side * 0.2, 0.62, -0.35), new THREE.Vector3(side * 0.055, 0.82, 0.40), 0.018);
    bar(new THREE.Vector3(side * 0.055, 0.82, 0.40), new THREE.Vector3(0, 0.60, 0.55), 0.018);
  }
  bar(new THREE.Vector3(-0.055, 0.82, 0.40), new THREE.Vector3(0.055, 0.82, 0.40), 0.018);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), helmetMaterial), 0, 0.72, -0.20);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 8, 0, Math.PI * 2, 0.35, 0.8), carbon);
  visor.scale.set(1, 0.72, 0.48);
  add(visor, 0, 0.735, -0.095);
  // Steering wheel is intentionally restrained so it reads in the cockpit without blocking the T-Cam.
  box(0.23, 0.12, 0.035, carbon, 0, 0.60, 0.17);
  box(0.15, 0.055, 0.012, white, 0, 0.615, 0.19);

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
      drsFlapAngle = damp(drsFlapAngle, drsOpen ? DRS_OPEN_ANGLE : DRS_CLOSED_ANGLE, 8, dt);
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