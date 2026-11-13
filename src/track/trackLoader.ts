import * as THREE from 'three';
import { CIRCUIT } from '../config';
import type { RoadTrack } from '../types';
import { createHeightFunction, createTerrain } from './createTerrain';
import { parseAndValidateTrackCsv, TrackDataError } from './trackCsv';
import { buildCenterline, checkCenterline, createTrackQueries, pointAtDistance } from './trackGeometry';
import type { WorldSample } from './trackGeometry';
import { createRoadMeshes } from './roadMesh';
import { applyWidthZones } from './widthZones';
import type { TracedWidths } from './tracedWidths';

/**
 * Builds a drivable closed circuit from TUM-format CSV text.
 *
 * Coordinate conversion: the file's (x_m, y_m) is a metric plane with y pointing "up" on the
 * map. The game's ground plane is (x, z) with z pointing "down" (south), so
 *   world.x = x_m - centreX      world.z = -(y_m - centreY)
 * where the centre is the middle of the circuit's bounding box. This keeps the circuit's true
 * shape (no mirroring) and its direction of travel, and keeps the numbers small. No other
 * change is made to the coordinates; the source has no elevation, so the road is flat.
 *
 * If `tracedWidths` is given (road edges traced from imagery), its left/right widths replace the CSV's.
 *
 * Throws TrackDataError for missing/malformed/unsuitable data. There is deliberately no fallback.
 */
export function createTrackFromCsv(
  csvText: string,
  sourceName: string,
  trackName: string,
  tracedWidths: TracedWidths | null = null,
): RoadTrack {
  const { samples, notes } = parseAndValidateTrackCsv(csvText, sourceName);

  // --- Source (x_m, y_m) -> world (x, z) ---
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  }
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const csvWorldSamples: WorldSample[] = samples.map((s) => ({
    x: s.x - centreX,
    z: -(s.y - centreY),
    widthLeft: s.widthLeft,
    widthRight: s.widthRight,
  }));

  // --- Widths: traced road edges if available, otherwise the CSV's; then optional width zones ---
  const csvWidths = csvWorldSamples.map((s) => ({ widthLeft: s.widthLeft, widthRight: s.widthRight }));
  let baseSamples = csvWorldSamples;
  if (tracedWidths) {
    if (tracedWidths.left.length !== csvWorldSamples.length) {
      throw new TrackDataError(`${sourceName}: traced widths have ${tracedWidths.left.length} rows but the track has ${csvWorldSamples.length}.`);
    }
    baseSamples = csvWorldSamples.map((s, i) => ({ ...s, widthLeft: tracedWidths.left[i], widthRight: tracedWidths.right[i] }));
    notes.push('Road widths come from the traced road edges (monza-widths.csv), not from the CSV.');
  }
  const zoned = applyWidthZones(baseSamples, CIRCUIT.widthZones, sourceName);
  const worldSamples = zoned.samples;
  notes.push(...zoned.notes);

  // --- Centerline, checks, queries ---
  const centerline = buildCenterline(worldSamples, CIRCUIT.resampleSpacing);
  const stats = checkCenterline(centerline, sourceName);
  const queries = createTrackQueries(centerline, CIRCUIT.queryCellSize);

  // --- Visuals ---
  const heightAt = createHeightFunction(queries.distanceTo);
  const group = new THREE.Group();
  group.add(createTerrain(0, 0, heightAt));
  group.add(createRoadMeshes(centerline));

  // --- Start position: the first row of the file. The file has no start/finish metadata. ---
  const start = pointAtDistance(centerline, CIRCUIT.startDistance);

  const roadPoints: THREE.Vector3[] = [];
  for (let i = 0; i < centerline.count; i++) {
    roadPoints.push(new THREE.Vector3(centerline.x[i], CIRCUIT.roadY, centerline.z[i]));
  }

  console.info(
    `[track] ${trackName} loaded from ${sourceName}: ${notes.join(' ')} ` +
      `Lap ${stats.lapLength.toFixed(0)} m, ${stats.points} road points, ` +
      `road width ${stats.minRoadWidth.toFixed(1)}-${stats.maxRoadWidth.toFixed(1)} m, ` +
      `tightest corner radius ${stats.minRadius.toFixed(1)} m.`,
  );

  return {
    name: trackName,
    object: group,
    roadWidth: (stats.minRoadWidth + stats.maxRoadWidth) / 2, // informational only; widths vary
    lapLength: centerline.lapLength,
    start,
    center: { x: 0, z: 0 },
    samples: roadPoints,
    heightAt,
    distanceToCenterline: (x, z) => queries.distanceTo(x, z),
    nearest: queries.nearest,
    isOnRoad: queries.isOnRoad,
    debug: {
      source: worldSamples,
      originalWidths: csvWidths,
      centerline,
      centre: { x: centreX, y: centreY },
    },
  };
}