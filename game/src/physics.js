// physics.js — arcade flight model for SENJA. Throttle sets the target speed;
// pitch and bank are the pilot's tools; banking turns the plane; slow flight sinks;
// fuel drains with throttle and only comes back on a runway; hard touchdowns hurt.
import { heightAt, stripOf, ISLANDS } from './world.js';

export const MAX_SPEED = 58;      // m/s at full throttle
export const STALL_SPEED = 13;    // below this the wings stop flying
export const TAKEOFF_SPEED = 17;  // speed needed to lift off the ground
export const GEAR_HEIGHT = 1.45;  // wheels below the plane's origin

export function makeFlightState(homeIsland) {
  const strip = stripOf(homeIsland);
  return {
    x: strip.x, y: heightAt(strip.x, strip.z) + GEAR_HEIGHT, z: strip.z,
    heading: strip.hdg, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: 100, damage: 0,
    verticalSpeed: 0, onGround: true, gearDown: true,
    crashed: false, crashReason: '',
    outOfBounds: false,
  };
}

// Forward unit vector from heading + pitch. Nose is local -Z.
export function forwardOf(state) {
  const cp = Math.cos(state.pitch);
  return {
    x: -Math.sin(state.heading) * cp,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.heading) * cp,
  };
}

// Compass heading in degrees: 0 = north (-Z), 90 = east (+X).
export function compassOf(heading) {
  const deg = (360 - (heading * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function nearestStrip(x, z) {
  let best = null, bestD = Infinity;
  for (const isl of ISLANDS) {
    if (!isl.strip) continue;
    const s = stripOf(isl);
    const dx = x - s.x, dz = z - s.z;
    const along = -dx * Math.sin(s.hdg) - dz * Math.cos(s.hdg);
    const across = -dx * Math.cos(s.hdg) + dz * Math.sin(s.hdg);
    const d = Math.hypot(along, across);
    if (d < bestD) { bestD = d; best = { strip: s, along, across, dist: d }; }
  }
  return best;
}

// One simulation step. input: { pitch: -1..1, roll: -1..1, throttle: -1..1,
// gearToggle, } — returns events the game loop reacts to.
export function stepFlight(state, input, dt) {
  const events = [];
  if (state.crashed) return events;

  const speedFactor = Math.min(1, Math.max(0.25, state.speed / 30));
  const dtC = Math.min(dt, 0.05);

  // --- Throttle and speed. ---
  state.throttle = Math.min(1, Math.max(0, state.throttle + input.throttle * dtC * 0.45));
  if (state.fuel <= 0) state.throttle = 0;
  const targetSpeed = state.throttle * MAX_SPEED;
  state.speed += (targetSpeed - state.speed) * Math.min(1, dtC * 0.35);
  // Climbing bleeds speed; diving gains it.
  state.speed -= Math.sin(state.pitch) * 8 * dtC;
  state.speed = Math.min(state.speed, MAX_SPEED + 12);

  // --- Pitch and roll. ---
  const pitchRate = 0.55 * speedFactor;
  state.pitch += input.pitch * pitchRate * dtC;
  state.pitch = Math.max(-0.6, Math.min(0.6, state.pitch));
  const rollRate = 1.15 * speedFactor;
  state.roll += input.roll * rollRate * dtC;
  state.roll = Math.max(-1.1, Math.min(1.1, state.roll));
  // Hands off: the plane gently levels itself.
  if (input.roll === 0) state.roll = angleLerp(state.roll, 0, Math.min(1, dtC * 0.6));
  if (input.pitch === 0) state.pitch = angleLerp(state.pitch, 0, Math.min(1, dtC * 0.25));
  // Banked turn: heading follows the bank.
  state.heading -= state.roll * 0.55 * dtC * (0.5 + 0.5 * speedFactor);

  // --- Fuel. ---
  if (!state.onGround) {
    state.fuel = Math.max(0, state.fuel - (0.22 + state.throttle * 0.55) * dtC);
    if (state.fuel <= 0 && !state._fuelWarned) {
      state._fuelWarned = true;
      events.push({ type: 'fuel-empty' });
    }
  }

  // --- Move. ---
  const fwd = forwardOf(state);
  let vy = fwd.y * state.speed;
  // Slow flight sinks: below stall speed the wings give up — only in the air.
  if (state.speed < STALL_SPEED && !state.onGround) {
    vy -= (STALL_SPEED - state.speed) * 0.85;
  }
  state.verticalSpeed = vy;
  state.x += fwd.x * state.speed * dtC;
  state.z += fwd.z * state.speed * dtC;
  state.y += vy * dtC;

  // --- Stay near the archipelago: nudge the heading home past the edge. ---
  const distHome = Math.hypot(state.x, state.z);
  if (distHome > 1250) {
    state.outOfBounds = true;
    const homeHdg = Math.atan2(-state.x, -state.z);
    state.heading = angleLerp(state.heading, homeHdg, Math.min(1, dtC * 0.5));
  } else {
    state.outOfBounds = false;
  }

  // --- Ground contact. A 5 cm epsilon keeps a resting plane from flip-flopping
  // between airborne and grounded on floating-point noise at the boundary. ---
  const ground = heightAt(state.x, state.z);
  const wheelsY = state.y - GEAR_HEIGHT;
  if (wheelsY <= ground + 0.05) {
    state.y = ground + GEAR_HEIGHT;
    const onSea = ground <= 0.1;
    const near = nearestStrip(state.x, state.z);
    const strip = near && near.dist < 40 ? near.strip : null;
    let aligned = false;
    if (strip) {
      const hdgDiff = Math.abs(((compassOf(state.heading) - compassOf(strip.hdg) + 540) % 360) - 180);
      aligned = hdgDiff < 30;
    }
    // Landing damage counts only on a real touchdown: a plane already sitting
    // on the ground takes no impact from a numerical dip.
    const wasAirborne = !state.onGround;
    const touchdownVs = wasAirborne ? state.verticalSpeed : 0;

    if (onSea) {
      state.crashed = true;
      state.crashReason = 'ditched in the sea';
      events.push({ type: 'crash', reason: state.crashReason });
      return events;
    }

    const hard = touchdownVs < -5.5;
    const fast = wasAirborne && state.speed > 34;
    if (hard || fast) {
      const hit = Math.max(0, -touchdownVs - 5.5) * 9 + (fast ? (state.speed - 34) * 2 : 0);
      state.damage += hit;
      if (state.damage >= 100) {
        state.crashed = true;
        state.crashReason = 'hard landing on the rocks';
        events.push({ type: 'crash', reason: state.crashReason });
        return events;
      }
      events.push({ type: 'hard-landing', damage: hit });
    }

    state.onGround = true;
    // On the ground the plane settles: roll levels out, nose sits slightly up,
    // but the pilot can still pull back to rotate for takeoff.
    state.roll = angleLerp(state.roll, 0, Math.min(1, dtC * 3));
    state.pitch = angleLerp(state.pitch, 0.08, Math.min(1, dtC * 2));
    state.verticalSpeed = 0;
    const wasOnStrip = state._onStrip;
    state._onStrip = (strip && aligned) ? strip : null;
    if (state._onStrip && !wasOnStrip) {
      events.push({ type: 'landed', strip: state._onStrip });
    }
    // Braking on the ground; refuel only on a proper strip, once slow.
    state.speed = Math.max(0, state.speed - (state.throttle > 0.15 ? 2 : 16) * dtC);
    if (state._onStrip && state.speed < 8) {
      state.fuel = Math.min(100, state.fuel + 22 * dtC);
      state._fuelWarned = false;
    }
  } else {
    state.onGround = false;
    state._onStrip = null;
    // Lift off when fast enough and pulling up.
    if (state._wasGround && state.speed > TAKEOFF_SPEED && state.pitch > 0.06) {
      events.push({ type: 'takeoff' });
    }
  }
  state._wasGround = state.onGround;

  // Gear toggle is handled by the caller through input.gearToggle.
  return events;
}
