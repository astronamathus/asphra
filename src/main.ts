import './style.css';
import { AUTODRIVE, CAMERA, CAR_SIZE, COCKPIT_CAMERA, VEHICLE, WORLD } from './config';
import { createAutopilot } from './car/autopilot';
import type { Autopilot } from './car/autopilot';
import { createCameraRig } from './car/chaseCamera';
import { createCar } from './car/createCar';
import { createGearbox } from './car/gearbox';
import { inDrsZone } from './car/vehicleLimits';
import { createControls } from './car/controls';
import { createVehiclePhysics } from './car/vehiclePhysics';
import { createScene } from './scene/createScene';
import { createScenery } from './scene/createScenery';
import { createMonzaTrack } from './track/createMonzaTrack';
import { loadMonzaRaceline } from './track/loadRaceline';
import { loadMonzaReferenceLap } from './track/loadREferenceLap';
import type { RacelineResult } from './track/loadRaceline';
import { fitRacelineToRoad } from './track/racelineFit';
import { createHud } from './ui/hud';
import { showFatalError } from './ui/fatalError';
import { createDebugView } from './debug/debugView'; // TEMPORARY
import type { RoadTrack } from './types';

/**
 * Builds the whole game inside `container` and starts it.
 * Returns a function that stops the game and frees everything it created.
 */
export function startGame(container: HTMLElement): () => void {
  const ctx = createScene(container);

  // The track comes only from src/tracks/monza.csv. If that data is missing or invalid we stop
  // here and show why; there is deliberately no fallback circuit.
  let track: RoadTrack;
  try {
    track = createMonzaTrack();
  } catch (error) {
    console.error(error);
    ctx.dispose();
    const message = error instanceof Error ? error.message : String(error);
    return showFatalError(
      container,
      'The Monza track data could not be loaded',
      `${message}\n\nCheck src/tracks/monza.csv (TUM racetrack-database format).`,
    );
  }

  const scenery = createScenery(track);
  ctx.scene.add(track.object, scenery);

  const car = createCar();
  ctx.scene.add(car.group);

  const physics = createVehiclePhysics(VEHICLE);
  const controls = createControls(window);
  const cameraRig = createCameraRig(ctx.camera, CAMERA, track.heightAt, COCKPIT_CAMERA);
  const hud = createHud(container);
  const gearbox = createGearbox();

  // --- Autodrive: needs the racing line from src/tracks/monza-raceline.csv ---
  const racelineFile = loadMonzaRaceline(track.debug.centre);
  // The line the autopilot really drives: the file's line, moved inwards where it would put the
  // 2 m wide car over the road edge.
  let racelineResult: RacelineResult = racelineFile;
  if (racelineFile.raceline) {
    const fit = fitRacelineToRoad(racelineFile.raceline.points, track, CAR_SIZE.width / 2 + AUTODRIVE.lineEdgeClearance);
    racelineResult = {
      raceline: { points: fit.points, rows: racelineFile.raceline.rows },
      message: `${racelineFile.message}; ${fit.moved} points moved up to ${fit.maxShift.toFixed(2)} m off the road edges`,
    };
  }
  const referenceResult = loadMonzaReferenceLap();
  let autopilot: Autopilot | null = null;
  let autopilotProblem = `no racing line (${racelineResult.message})`;
  if (racelineResult.raceline) {
    try {
      autopilot = createAutopilot(racelineResult.raceline.points, VEHICLE, referenceResult.lap);
      autopilotProblem = '';
      const plan = autopilot.plan;
      console.info(
        `[autodrive] ready: racing line ${plan.lapLength.toFixed(0)} m, planned speed ` +
          `${(plan.minSpeed * 3.6).toFixed(0)}-${(plan.maxSpeed * 3.6).toFixed(0)} km/h, ` +
          `planned lap ${plan.lapTime.toFixed(1)} s. Target pace: ` +
          (plan.usesReference ? 'the real qualifying lap, held down where the game car cannot match it.' : `the game car's own limits (${referenceResult.message}).`),
      );
    } catch (error) {
      autopilotProblem = error instanceof Error ? error.message : String(error);
      console.warn(`[autodrive] unavailable: ${autopilotProblem}`);
    }
  }
  let autoActive = false;

  function setAuto(active: boolean, message?: string): void {
    autoActive = active;
    hud.setAuto(active);
    if (message) hud.showMessage(message, 2500);
  }

  const debugView = createDebugView(container, track, racelineResult); // TEMPORARY (press V)

  /** Puts the car at rest on the road at the given point, facing the given direction. */
  function placeCar(x: number, z: number, heading: number, message?: string): void {
    physics.reset(x, z, heading);
    car.reset();
    car.update(0, physics.state, track.heightAt);
    cameraRig.snap(physics.state, car.group);
    if (message) hud.showMessage(message);
  }

  /** R key: back to the starting position. */
  function resetToStart(message?: string): void {
    placeCar(track.start.x, track.start.z, track.start.heading, message);
  }

  /** Automatic recovery: back onto the nearest road point, facing the direction of travel. */
  function recoverToRoad(): void {
    const near = track.nearest(physics.state.x, physics.state.z);
    placeCar(near.x, near.z, near.heading, 'Returned to the road');
  }

  const onResize = (): void => ctx.resize();
  window.addEventListener('resize', onResize);

  resetToStart();

  let lastTime = performance.now();
  let animationId = 0;
  let disposed = false;

  function frame(now: number): void {
    animationId = requestAnimationFrame(frame);

    // Clamp the frame time so a lag spike or a background tab never causes a huge jump.
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), WORLD.maxFrameTime);
    lastTime = now;

    const state = physics.state;

    // Any newly pressed key (other than E) hands control back to the driver.
    if (controls.consumeAnyKey() && autoActive) setAuto(false, 'Manual control');
    if (controls.consumeReset()) resetToStart('Car reset');
    if (controls.consumeCameraToggle()) hud.showMessage(`Camera: ${cameraRig.toggle()} view`, 1500);

    if (controls.consumeAutoToggle()) {
      if (autoActive) {
        setAuto(false, 'Manual control');
      } else if (!autopilot) {
        hud.showMessage(`Autodrive unavailable: ${autopilotProblem}`, 4500);
      } else {
        const check = autopilot.engage(state);
        if (check.ok) setAuto(true, 'Autodrive on');
        else hud.showMessage(`Autodrive cannot start: ${check.reason}`, 4500);
      }
    }

    const onRoad = track.isOnRoad(state.x, state.z, WORLD.roadEdgeTolerance);
    const input = autoActive && autopilot ? autopilot.compute(state, dt) : controls.read();
    // DRS opens by itself in the DRS zones while the throttle is (nearly) fully down and the brake is off.
    const lapFraction = track.nearest(state.x, state.z).s / track.lapLength;
    const drsOpen = inDrsZone(lapFraction) && input.throttle > 0.9 && input.brake < 0.1;
    input.drs = drsOpen;
    physics.update(dt, input, onRoad);

    if (!onRoad && track.distanceToCenterline(state.x, state.z) > WORLD.autoResetDistance) {
      recoverToRoad();
    }

    car.update(dt, state, track.heightAt);
    cameraRig.update(dt, state, car.group);
    ctx.updateEnvironment(car.group.position);

    const speed = Math.hypot(state.vx, state.vz);
    hud.update(speed * 3.6, !onRoad);
    hud.setGear(gearbox.update(speed * 3.6));
    hud.setDrs(drsOpen);

    let autoText = '';
    if (autoActive && autopilot) {
      const info = autopilot.info();
      autoText = `ON  target ${(info.targetSpeed * 3.6).toFixed(0)} km/h, actual ${(speed * 3.6).toFixed(0)}, line offset ${info.lineOffset >= 0 ? '+' : ''}${info.lineOffset.toFixed(2)} m`;
    } else if (autopilot) {
      autoText = `off (press E; planned lap ${autopilot.plan.lapTime.toFixed(0)} s)`;
    } else {
      autoText = `unavailable: ${autopilotProblem}`;
    }
    debugView.update(state, autoText); // TEMPORARY

    ctx.renderer.render(ctx.scene, ctx.camera);
  }

  animationId = requestAnimationFrame(frame);

  return () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    hud.dispose();
    debugView.dispose(); // TEMPORARY
    ctx.dispose(); // also frees the track, scenery and car (they are in the scene)
  };
}

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('Could not find the #app element in index.html');

const stopGame = startGame(container);

// When Vite hot-reloads this file, shut the old game down first.
if (import.meta.hot) {
  import.meta.hot.dispose(() => stopGame());
}