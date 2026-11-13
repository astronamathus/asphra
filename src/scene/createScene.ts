import * as THREE from 'three';
import { WORLD } from '../config';
import { disposeObject } from '../utils/dispose';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(): void;
  /** Keeps the sky and the shadow-casting sun centred on the car. */
  updateEnvironment(focus: THREE.Vector3): void;
  dispose(): void;
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying vec3 vDir;
  void main() {
    float h = clamp(normalize(vDir).y, 0.0, 1.0);
    vec3 col = mix(horizonColor, topColor, pow(h, 0.5));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, WORLD.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD.horizonColor);
  scene.fog = new THREE.Fog(WORLD.horizonColor, WORLD.fogNear, WORLD.fogFar);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 4000);

  // Sky dome: a big sphere with a vertical colour gradient that follows the camera.
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(WORLD.skyTopColor) },
      horizonColor: { value: new THREE.Color(WORLD.horizonColor) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // Lighting
  const hemi = new THREE.HemisphereLight(WORLD.hemiSkyColor, WORLD.hemiGroundColor, WORLD.hemiIntensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(WORLD.sunColor, WORLD.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = WORLD.shadowSize;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 250;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  scene.add(sun.target);

  const sunOffset = new THREE.Vector3(...WORLD.sunOffset);

  function resize(): void {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateEnvironment(focus: THREE.Vector3): void {
    sky.position.copy(camera.position);
    sun.position.copy(focus).add(sunOffset);
    sun.target.position.copy(focus);
  }

  function dispose(): void {
    disposeObject(scene);
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  resize();

  return { renderer, scene, camera, resize, updateEnvironment, dispose };
}