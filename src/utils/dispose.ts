import * as THREE from 'three';

/** Frees the GPU memory used by every mesh below `root`. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }

    const instanced = obj as THREE.InstancedMesh;
    if (instanced.isInstancedMesh) instanced.dispose();
  });
}