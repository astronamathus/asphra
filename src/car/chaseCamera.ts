import * as THREE from 'three';
import type { ChaseCameraParams, VehicleState } from '../types';
import { clamp, damp, dampAngle } from '../utils/math';

export type CameraMode = 'chase' | 'cockpit';

export interface CameraRig {
  readonly mode: CameraMode;
  /** Switches between the chase view and the cockpit view; returns the new mode. */
  toggle(): CameraMode;
  /** Jump straight to the correct position (used at start and on reset). */
  snap(state: VehicleState, car: THREE.Object3D): void;
  update(dt: number, state: VehicleState, car: THREE.Object3D): void;
}

const CHASE_NEAR = 0.3;
const COCKPIT_NEAR = 0.08; // the halo and nose are very close to the cockpit camera

/**
 * The game camera. Chase view: behind the car, a little above its roof, tilted up so the horizon
 * sits about 40% down the screen and the car low in the frame; it swings round smoothly behind
 * the car's heading and widens its field of view with speed. Cockpit view: fixed to the car just
 * above and behind the driver's helmet.
 */
export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  params: ChaseCameraParams,
  heightAt: (x: number, z: number) => number,
  cockpit: { x: number; y: number; z: number; fov: number },
): CameraRig {
  let mode: CameraMode = 'chase';
  let cameraHeading = 0;
  let cameraY = 0;
  let fov = params.baseFov;
  const lookTarget = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const carQuaternion = new THREE.Quaternion();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  function speedOf(state: VehicleState): number {
    return clamp(Math.hypot(state.vx, state.vz) / params.speedReference, 0, 1);
  }

  function placeChase(state: VehicleState): void {
    const distance = params.distance + params.speedDistance * speedOf(state);
    const sinH = Math.sin(cameraHeading);
    const cosH = Math.cos(cameraHeading);

    const x = state.x - sinH * distance;
    const z = state.z - cosH * distance;
    const groundY = heightAt(x, z);
    const y = Math.max(cameraY + params.height, groundY + params.groundClearance);
    camera.position.set(x, y, z);

    // Look ahead along the heading, tilted up by pitchDeg from level.
    const horizontal = distance + params.lookAhead;
    lookTarget.set(state.x + sinH * params.lookAhead, y + horizontal * Math.tan((params.pitchDeg * Math.PI) / 180), state.z + cosH * params.lookAhead);
    camera.lookAt(lookTarget);
  }

  function placeCockpit(state: VehicleState, car: THREE.Object3D): void {
    car.updateMatrixWorld(true);
    eye.set(cockpit.x, cockpit.y, cockpit.z);
    car.localToWorld(eye);
    camera.position.copy(eye);
    // The car faces +z but a camera looks along -z, so turn it half a circle about the vertical.
    car.getWorldQuaternion(carQuaternion);
    camera.quaternion.copy(carQuaternion).multiply(flip);
    fov = cockpit.fov + 10 * speedOf(state);
  }

  function applyProjection(): void {
    camera.fov = fov;
    camera.near = mode === 'cockpit' ? COCKPIT_NEAR : CHASE_NEAR;
    camera.updateProjectionMatrix();
  }

  return {
    get mode(): CameraMode {
      return mode;
    },

    toggle(): CameraMode {
      mode = mode === 'chase' ? 'cockpit' : 'chase';
      fov = mode === 'cockpit' ? cockpit.fov : params.baseFov;
      applyProjection();
      return mode;
    },

    snap(state: VehicleState, car: THREE.Object3D): void {
      cameraHeading = state.heading;
      cameraY = car.position.y;
      fov = mode === 'cockpit' ? cockpit.fov : params.baseFov;
      if (mode === 'cockpit') placeCockpit(state, car);
      else placeChase(state);
      applyProjection();
    },

    update(dt: number, state: VehicleState, car: THREE.Object3D): void {
      cameraHeading = dampAngle(cameraHeading, state.heading, params.headingSmoothing, dt);
      cameraY = damp(cameraY, car.position.y, params.heightSmoothing, dt);
      if (mode === 'cockpit') {
        placeCockpit(state, car);
      } else {
        fov = damp(fov, params.baseFov + params.speedFov * speedOf(state), params.fovSmoothing, dt);
        placeChase(state);
      }
      applyProjection();
    },
  };
}