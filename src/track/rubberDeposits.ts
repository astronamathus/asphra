import * as THREE from 'three';
import { CIRCUIT } from '../config';
import type { RoadTrack } from '../types';

interface Point { x: number; z: number }

const TYRE_TRACK_OFFSET = 0.56;
const TYRE_TRACK_WIDTH = 0.34;
const RUBBER_Y = CIRCUIT.roadY + 0.006;

/**
 * Adds subtle twin tyre deposits along the fitted racing line.
 * The raceline is only a visual guide here: every ribbon is checked against the actual road
 * boundaries, so the deposits cannot spill onto grass or runoff.
 */
export function createRubberDeposits(raceline: Point[], track: RoadTrack): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Monza racing-line rubber deposits';
  if (raceline.length < 3) return group;

  const leftTrack: THREE.Vector3[] = [];
  const rightTrack: THREE.Vector3[] = [];

  for (const point of raceline) {
    const road = track.nearest(point.x, point.z);
    const leftX = Math.cos(road.heading);
    const leftZ = -Math.sin(road.heading);

    const left = {
      x: point.x + leftX * TYRE_TRACK_OFFSET,
      z: point.z + leftZ * TYRE_TRACK_OFFSET,
    };
    const right = {
      x: point.x - leftX * TYRE_TRACK_OFFSET,
      z: point.z - leftZ * TYRE_TRACK_OFFSET,
    };

    // Keep both tyre paths entirely on the asphalt with a small safety margin.
    const leftNear = track.nearest(left.x, left.z);
    const rightNear = track.nearest(right.x, right.z);
    const leftValid = Math.abs(leftNear.lateralOffset) <=
      (leftNear.lateralOffset >= 0 ? leftNear.widthLeft : leftNear.widthRight) - TYRE_TRACK_WIDTH / 2;
    const rightValid = Math.abs(rightNear.lateralOffset) <=
      (rightNear.lateralOffset >= 0 ? rightNear.widthLeft : rightNear.widthRight) - TYRE_TRACK_WIDTH / 2;

    leftTrack.push(leftValid ? new THREE.Vector3(left.x, RUBBER_Y, left.z) : new THREE.Vector3(NaN, RUBBER_Y, NaN));
    rightTrack.push(rightValid ? new THREE.Vector3(right.x, RUBBER_Y, right.z) : new THREE.Vector3(NaN, RUBBER_Y, NaN));
  }

  const material = new THREE.MeshBasicMaterial({
    color: 0x252729,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

  const addRibbon = (points: THREE.Vector3[], name: string) => {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexCount = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) continue;
      if (a.distanceTo(b) > 12) continue;

      const direction = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
      if (direction.lengthSq() < 1e-8) continue;
      const sideX = -direction.y * TYRE_TRACK_WIDTH / 2;
      const sideZ = direction.x * TYRE_TRACK_WIDTH / 2;
      const base = vertexCount;

      positions.push(
        a.x + sideX, RUBBER_Y, a.z + sideZ,
        a.x - sideX, RUBBER_Y, a.z - sideZ,
        b.x + sideX, RUBBER_Y, b.z + sideZ,
        b.x - sideX, RUBBER_Y, b.z - sideZ,
      );
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      vertexCount += 4;
    }

    if (indices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = 2;
    group.add(mesh);
  };

  addRibbon(leftTrack, 'Left tyre rubber');
  addRibbon(rightTrack, 'Right tyre rubber');
  return group;
}
