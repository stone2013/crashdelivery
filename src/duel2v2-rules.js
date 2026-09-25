/* 2v2 delivery duel: deterministic host-authoritative match rules.
 * This module is embedded by build.py so the released game remains one HTML file.
 * Vehicle movement, collision geometry, room assignment and rendering are integrated separately.
 */
(() => {
  'use strict';

  const TEAMS = Object.freeze(['amber', 'teal']);
  const MATCH_SECONDS = 300;
  const CANNON_COOLDOWN = 5;
  const SLOW_SECONDS = 3;
  const FIRE_SECONDS_TO_EXPLOSION = 30;
  const FIRE_LIFE_PER_SECOND = 1.2;
  const EXTINGUISH_SECONDS = 2.5;
  const WRENCH_SECONDS = 4;
  const MAX_EVENTS = 512;

  const teamForPlayer = (playerId) => {
    const id = Number(playerId);
    return Number.isInteger(id) && id >= 0 && id < 4 ? TEAMS[id < 2 ? 0 : 1] : null;
  };

  function createMatch({ timeLimit = MATCH_SECONDS, cargoPerTeam = 18 } = {}) {
    const cargo = Array.from({ length: Math.max(0, Math.floor(cargoPerTeam)) }, (_, i) => `box-${i + 1}`);
    const makeTruck = (team) => ({
      team, delivered: 0, deliveredBoxes: [], cargo: cargo.slice(),
      targetIndex: team === 'amber' ? 0 : 9,
      vehicle: team === 'amber'
        ? { p: [3.2, .12, 72], yaw: 0, speed: 0, inputSeq: 0, input: { throttle: 0, steer: 0, brake: false } }
        : { p: [-3.2, .12, 78], yaw: Math.PI, speed: 0, inputSeq: 0, input: { throttle: 0, steer: 0, brake: false } },
      hp: 100, hitCount: 0, slowUntil: 0, disabled: false, burning: false,
      burnTotal: 0, repair: null, cannonReadyAt: 0, exploded: false,
    });
    return {
      protocol: 'crash-delivery-duel2v2-1',
      active: true,
      elapsed: 0,
      timeLimit: Math.max(30, Number(timeLimit) || MATCH_SECONDS),
      overtime: false,
      overtimeRemaining: 60,
      winner: null,
      endReason: '',
      trucks: { amber: makeTruck('amber'), teal: makeTruck('teal') },
      consumedEvents: [],
      projectiles: [],
      nextProjectileId: 1,
      events: [],
    };
  }

  function emit(match, type, data = {}) {
    match.events.push({ type, at: match.elapsed, ...data });
    if (match.events.length > 64) match.events.splice(0, match.events.length - 64);
  }

  function acceptEvent(match, eventId) {
    if (typeof eventId !== 'string' || !eventId || eventId.length > 96
        || match.consumedEvents.includes(eventId)) return false;
    match.consumedEvents.push(eventId);
    if (match.consumedEvents.length > MAX_EVENTS) match.consumedEvents.splice(0, match.consumedEvents.length - MAX_EVENTS);
    return true;
  }

  function finish(match, winner, reason) {
    if (!match.active) return false;
    match.active = false;
    match.winner = winner;
    match.endReason = reason;
    emit(match, 'match-end', { winner, reason });
    return true;
  }

  function deliver(match, team, boxId, eventId) {
    const truck = match.trucks[team];
    if (!match.active || !truck || !acceptEvent(match, eventId)) return false;
    const index = truck.cargo.indexOf(boxId);
    if (index < 0) return false;
    truck.cargo.splice(index, 1);
    truck.deliveredBoxes.push(boxId);
    truck.delivered++;
    truck.targetIndex = (truck.targetIndex + 1) % 18;
    emit(match, 'delivery', { team, boxId, delivered: truck.delivered });
    if (match.overtime) finish(match, team, 'overtime-delivery');
    return true;
  }

  function fireCannon(match, playerId, eventId) {
    const team = teamForPlayer(playerId), truck = team && match.trucks[team];
    if (!match.active || !truck || ![1, 3].includes(Number(playerId)) || !acceptEvent(match, eventId)) return null;
    if (truck.disabled || truck.exploded || match.elapsed < truck.cannonReadyAt || !truck.cargo.length) return null;
    const boxId = truck.cargo.shift();
    truck.cannonReadyAt = match.elapsed + CANNON_COOLDOWN;
    const projectile = { id: match.nextProjectileId++, boxId, team, active: true };
    match.projectiles.push(projectile);
    emit(match, 'cannon-fire', { team, projectileId: projectile.id, boxId });
    return { ...projectile };
  }

  function hitTruck(match, projectileId, eventId) {
    if (!match.active || !acceptEvent(match, eventId)) return false;
    const projectile = match.projectiles.find((item) => item.id === projectileId && item.active);
    if (!projectile) return false;
    projectile.active = false;
    const targetTeam = projectile.team === TEAMS[0] ? TEAMS[1] : TEAMS[0];
    const truck = match.trucks[targetTeam];
    if (truck.exploded || truck.disabled) return false;
    truck.hitCount++;
    truck.slowUntil = Math.max(truck.slowUntil, match.elapsed + SLOW_SECONDS);
    if (truck.hitCount >= 3) {
      truck.disabled = true;
      truck.burning = true;
      truck.repair = null;
      emit(match, 'truck-ignited', { team: targetTeam, hitCount: truck.hitCount, burnTotal: truck.burnTotal });
    } else {
      emit(match, 'truck-hit', { team: targetTeam, hitCount: truck.hitCount, slowUntil: truck.slowUntil });
    }
    return true;
  }

  function startRepair(match, playerId, tool, eventId) {
    const team = teamForPlayer(playerId), truck = team && match.trucks[team];
    if (!match.active || !truck || ![1, 3].includes(Number(playerId)) || !acceptEvent(match, eventId)
        || truck.exploded || !truck.disabled || truck.repair) return false;
    if (tool === 'extinguisher' && truck.burning) {
      truck.repair = { tool, progress: 0, required: EXTINGUISH_SECONDS, eventId };
      emit(match, 'repair-start', { team, tool });
      return true;
    }
    if (tool === 'wrench' && !truck.burning) {
      truck.repair = { tool, progress: 0, required: WRENCH_SECONDS, eventId };
      emit(match, 'repair-start', { team, tool });
      return true;
    }
    return false;
  }

  function stopRepair(match, playerId, eventId) {
    const team = teamForPlayer(playerId), truck = team && match.trucks[team];
    if (!truck || !acceptEvent(match, eventId) || !truck.repair) return false;
    emit(match, 'repair-cancel', { team, tool: truck.repair.tool });
    truck.repair = null;
    return true;
  }

  // Only slots 0 and 2 drive. Input sequence numbers make stale packets a no-op;
  // this function is intended to run on the room host, which owns the returned state.
  function drive(match, playerId, seq, controls) {
    const team = teamForPlayer(playerId), driverId = team === 'amber' ? 0 : team === 'teal' ? 2 : -1;
    const truck = team && match.trucks[team];
    if (!match.active || playerId !== driverId || !truck || !Number.isSafeInteger(seq)
        || seq <= truck.vehicle.inputSeq || !controls || typeof controls !== 'object') return false;
    truck.vehicle.inputSeq = seq;
    truck.vehicle.input = {
      throttle: Math.max(-1, Math.min(1, Number(controls.throttle) || 0)),
      steer: Math.max(-1, Math.min(1, Number(controls.steer) || 0)),
      brake: !!controls.brake,
    };
    return true;
  }

  function stepVehicle(truck, match, dt) {
    const vehicle = truck.vehicle, input = vehicle.input;
    if (truck.disabled || truck.exploded) { vehicle.speed = 0; return; }
    const throttle = input.throttle * (match.elapsed < truck.slowUntil ? speedFactor(match, truck.team) : 1);
    if (input.brake) vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), 13 * dt);
    else if (Math.abs(throttle) > .01) vehicle.speed += throttle * (vehicle.speed < 0 ? 13 : 8.6) * dt;
    else vehicle.speed *= Math.max(0, 1 - 1.8 * dt);
    vehicle.speed = Math.max(-5, Math.min(18, vehicle.speed));
    vehicle.yaw += input.steer * vehicle.speed * .032 * dt;
    vehicle.p[0] += -Math.sin(vehicle.yaw) * vehicle.speed * dt;
    vehicle.p[2] += -Math.cos(vehicle.yaw) * vehicle.speed * dt;
    vehicle.p[0] = Math.max(-225, Math.min(225, vehicle.p[0]));
    vehicle.p[2] = Math.max(-225, Math.min(225, vehicle.p[2]));
  }

  function tick(match, deltaSeconds) {
    if (!match.active) return match;
    const dt = Math.min(.25, Math.max(0, Number(deltaSeconds) || 0));
    if (!dt) return match;
    match.elapsed += dt;
    for (const team of TEAMS) {
      const truck = match.trucks[team];
      stepVehicle(truck, match, dt);
      if (truck.burning && !truck.exploded) {
        truck.burnTotal = Math.min(FIRE_SECONDS_TO_EXPLOSION, truck.burnTotal + dt);
        truck.hp = Math.max(0, truck.hp - FIRE_LIFE_PER_SECOND * dt);
        if (truck.burnTotal >= FIRE_SECONDS_TO_EXPLOSION) {
          truck.burning = false;
          truck.disabled = true;
          truck.exploded = true;
          truck.repair = null;
          emit(match, 'truck-explosion', { team, burnTotal: truck.burnTotal });
          finish(match, team === TEAMS[0] ? TEAMS[1] : TEAMS[0], 'truck-explosion');
          break;
        }
      }
      if (!truck.repair) continue;
      truck.repair.progress = Math.min(truck.repair.required, truck.repair.progress + dt);
      if (truck.repair.progress < truck.repair.required) continue;
      const tool = truck.repair.tool;
      truck.repair = null;
      if (tool === 'extinguisher' && truck.burning) {
        truck.burning = false;
        emit(match, 'fire-extinguished', { team, burnTotal: truck.burnTotal, remainingFireTime: FIRE_SECONDS_TO_EXPLOSION - truck.burnTotal });
      } else if (tool === 'wrench' && !truck.burning && truck.disabled) {
        truck.disabled = false;
        truck.hitCount = 0;
        truck.hp = Math.max(35, truck.hp);
        emit(match, 'truck-repaired', { team, hp: truck.hp, burnTotal: truck.burnTotal });
      }
    }
    if (match.active && match.elapsed >= match.timeLimit && !match.overtime) {
      const a = match.trucks.amber.delivered, b = match.trucks.teal.delivered;
      if (a !== b) finish(match, a > b ? 'amber' : 'teal', 'time-limit');
      else { match.overtime = true; emit(match, 'overtime-start', { duration: match.overtimeRemaining }); }
    } else if (match.active && match.overtime) {
      match.overtimeRemaining = Math.max(0, 60 - (match.elapsed - match.timeLimit));
      if (match.overtimeRemaining <= 0) finish(match, 'draw', 'overtime-expired');
    }
    return match;
  }

  function speedFactor(match, team) {
    const truck = match.trucks[team];
    if (!truck || truck.disabled || truck.exploded) return 0;
    if (match.elapsed < truck.slowUntil) return truck.hitCount >= 2 ? .45 : .7;
    return 1;
  }

  function publicState(match) {
    const truck = (source) => ({
      team: source.team, delivered: source.delivered, cargoCount: source.cargo.length,
      targetIndex: source.targetIndex,
      vehicle: { p: source.vehicle.p.slice(), yaw: source.vehicle.yaw, speed: source.vehicle.speed, inputSeq: source.vehicle.inputSeq },
      hp: Math.round(source.hp * 10) / 10, hitCount: source.hitCount,
      slowRemaining: Math.max(0, source.slowUntil - match.elapsed),
      disabled: source.disabled, burning: source.burning,
      burnTotal: Math.round(source.burnTotal * 1000) / 1000,
      burnRemaining: Math.max(0, FIRE_SECONDS_TO_EXPLOSION - source.burnTotal),
      repair: source.repair ? { tool: source.repair.tool, progress: source.repair.progress, required: source.repair.required } : null,
      exploded: source.exploded, cannonReadyIn: Math.max(0, source.cannonReadyAt - match.elapsed),
    });
    return {
      protocol: match.protocol, active: match.active, elapsed: match.elapsed, overtime: match.overtime,
      remaining: match.overtime ? match.overtimeRemaining : Math.max(0, match.timeLimit - match.elapsed), winner: match.winner,
      endReason: match.endReason,
      trucks: { amber: truck(match.trucks.amber), teal: truck(match.trucks.teal) },
      projectiles: match.projectiles.filter((item) => item.active).map((item) => ({ id:item.id,boxId:item.boxId,team:item.team,p:item.p?.slice()||null })),
      events: match.events.slice(),
    };
  }

  window.DeliveryDuel2v2 = Object.freeze({
    createMatch, teamForPlayer, drive, deliver, fireCannon, hitTruck, startRepair, stopRepair,
    tick, speedFactor, publicState,
    constants: Object.freeze({ MATCH_SECONDS, CANNON_COOLDOWN, SLOW_SECONDS,
      FIRE_SECONDS_TO_EXPLOSION, FIRE_LIFE_PER_SECOND, EXTINGUISH_SECONDS, WRENCH_SECONDS }),
  });
})();
