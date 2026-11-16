import * as THREE from 'three';

/** Frees the GPU memory used by every mesh below `root`. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.dispose();

    const material = mesh.material;
    const disposeMaterial = (m: THREE.Material) => {
      // Materials do not dispose their maps; release the procedural road texture explicitly.
      const mapped = m as THREE.Material & { map?: THREE.Texture | null };
      mapped.map?.dispose();
      m.dispose();
    };
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else {
      disposeMaterial(material);
    }

    const instanced = obj as THREE.InstancedMesh;
    if (instanced.isInstancedMesh) instanced.dispose();
  });
}