import * as THREE from 'three';
import { createCar } from '../car/createCar';
import { createCameraRig } from '../car/chaseCamera';
import { CAMERA, COCKPIT_CAMERA } from '../config';
import type { ChaseCameraParams, VehicleState } from '../types';

function measure(label: string, params: ChaseCameraParams, aspect: number, speedMs: number, carBox: THREE.Box3 | null, car?: ReturnType<typeof createCar>) {
  const theCar = car ?? createCar();
  const state: VehicleState = { x: 0, z: 0, heading: 0, vx: 0, vz: speedMs, yawRate: 0, steer: 0, longSpeed: speedMs, latSpeed: 0 };
  theCar.update(0, state, () => 0);
  const camera = new THREE.PerspectiveCamera(params.baseFov, aspect, 0.3, 4000);
  const rig = createCameraRig(camera, params, () => 0, COCKPIT_CAMERA);
  rig.snap(state, theCar.group); for (let i = 0; i < 120; i++) rig.update(1 / 60, state, theCar.group);
  camera.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(theCar.group); void carBox;
  const pts: THREE.Vector3[] = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z).project(camera));
  const xs = pts.map(p => (p.x + 1) / 2), ys = pts.map(p => (1 - p.y) / 2);
  // horizon: project a point very far ahead at eye height
  const far = new THREE.Vector3(0, camera.position.y, 4000).project(camera);
  console.log(`${label.padEnd(30)} car width ${(100 * (Math.max(...xs) - Math.min(...xs))).toFixed(1)}% of screen, height ${(100 * (Math.max(...ys) - Math.min(...ys))).toFixed(1)}%, car spans ${(100 * Math.min(...ys)).toFixed(0)}-${(100 * Math.max(...ys)).toFixed(0)}% down; horizon ${(100 * (1 - far.y) / 2).toFixed(0)}% down; camera ${camera.position.y.toFixed(2)} m high, ${(-camera.position.z).toFixed(1)} m behind the car centre`);
}
const aspect = 2472 / 1313;
const old: ChaseCameraParams = { ...CAMERA, distance: 7.5, speedDistance: 3, height: 2.6, lookAhead: 9, pitchDeg: -1.5, baseFov: 62 };
console.log('target screenshot: car about 17% of screen width, 19% of height, horizon about 37% down');
measure('OLD camera, standing still', old, aspect, 0, null);
measure('NEW chase camera, standing', CAMERA, aspect, 0, null);
measure('NEW chase camera, 300 km/h', CAMERA, aspect, 83, null);