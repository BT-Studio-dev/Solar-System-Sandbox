/* Shared, deterministic physics engine. Distances: AU. Time: years. Mass: solar masses. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SolarPhysics = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const G = 4 * Math.PI * Math.PI;
  const EARTH_MASS = 3.0034896e-6;
  const AU_PER_YEAR_TO_KMS = 4.74047;
  const MAX_BODIES = 40;
  const SOFTENING = 0.0001;
  const PLANETS = [
    ['Mercury', 0.387, 0.0553, '#b2a69b', 3.5, 0.6, 'Terrestrial planet'],
    ['Venus', 0.723, 0.815, '#e7c18b', 5, 2.4, 'Terrestrial planet'],
    ['Earth', 1, 1, '#68b6ff', 5.5, 4.0, 'Terrestrial planet'],
    ['Mars', 1.524, 0.107, '#ed8869', 4.5, 5.4, 'Terrestrial planet'],
    ['Jupiter', 5.203, 317.8, '#d5b18e', 11, 0.35, 'Gas giant'],
    ['Saturn', 9.537, 95.16, '#e7d7a6', 9, 2.0, 'Gas giant'],
    ['Uranus', 19.191, 14.54, '#8cd8dc', 7, 3.7, 'Ice giant'],
    ['Neptune', 30.069, 17.15, '#7c8dff', 7, 5.4, 'Ice giant']
  ];
  function initialBodies() {
    const bodies = [{ id: 'sun', name: 'Sun', mass: 1, x: 0, y: 0, vx: 0, vy: 0,
      color: '#ffd17a', radius: 15, kind: 'G-type main-sequence star', custom: false }];
    for (const [name, r, mass, color, radius, a, kind] of PLANETS) {
      const speed = Math.sqrt(G / r);
      bodies.push({ id: name.toLowerCase(), name, mass: mass * EARTH_MASS,
        x: Math.cos(a) * r, y: Math.sin(a) * r,
        vx: -Math.sin(a) * speed, vy: Math.cos(a) * speed,
        color, radius, kind, custom: false });
    }
    // Remove center-of-mass velocity without changing relative circular velocities.
    const total = bodies.reduce((s, b) => s + b.mass, 0);
    const px = bodies.reduce((s, b) => s + b.vx * b.mass, 0) / total;
    const py = bodies.reduce((s, b) => s + b.vy * b.mass, 0) / total;
    bodies.forEach(b => { b.vx -= px; b.vy -= py; });
    return bodies;
  }
  function accelerations(bodies) {
    const a = bodies.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const dx = bodies[j].x - bodies[i].x, dy = bodies[j].y - bodies[i].y;
        const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const f = G / (r2 * Math.sqrt(r2));
        a[i].x += dx * f * bodies[j].mass; a[i].y += dy * f * bodies[j].mass;
        a[j].x -= dx * f * bodies[i].mass; a[j].y -= dy * f * bodies[i].mass;
      }
    }
    return a;
  }
  // Symplectic kick-drift-kick (velocity Verlet); identical on desktop and Android.
  function step(bodies, dt) {
    const a = accelerations(bodies);
    bodies.forEach((b, i) => {
      b.vx += a[i].x * dt / 2; b.vy += a[i].y * dt / 2;
      b.x += b.vx * dt; b.y += b.vy * dt;
    });
    const next = accelerations(bodies);
    bodies.forEach((b, i) => {
      b.vx += next[i].x * dt / 2; b.vy += next[i].y * dt / 2;
    });
  }
  function advance(bodies, years) {
    if (!Number.isFinite(years) || years < 0 || years > 0.51) throw new Error('Invalid time interval');
    const n = Math.max(1, Math.ceil(years / 0.001));
    for (let i = 0; i < n; i++) step(bodies, years / n);
  }
  function energy(bodies) {
    let e = 0;
    bodies.forEach(b => { e += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy); });
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      e -= G * bodies[i].mass * bodies[j].mass /
        Math.sqrt((bodies[j].x - bodies[i].x) ** 2 + (bodies[j].y - bodies[i].y) ** 2 + SOFTENING ** 2);
    }
    return e;
  }
  function validateSave(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.bodies) ||
        data.bodies.length < 1 || data.bodies.length > MAX_BODIES ||
        !Number.isFinite(data.years) || data.years < 0) throw new Error('Invalid sandbox save');
    const ids = new Set();
    const bodies = data.bodies.map(b => {
      if (!b || typeof b.id !== 'string' || b.id.length > 80 || ids.has(b.id) ||
          typeof b.name !== 'string' || b.name.length > 40 || !b.name.trim() ||
          !/^#[0-9a-f]{6}$/i.test(b.color) ||
          !['mass', 'x', 'y', 'vx', 'vy', 'radius'].every(k => Number.isFinite(b[k])) ||
          b.mass <= 0 || b.mass > 10 || b.radius < 2 || b.radius > 30 ||
          Math.abs(b.x) > 1e6 || Math.abs(b.y) > 1e6 || Math.abs(b.vx) > 1e5 || Math.abs(b.vy) > 1e5) {
        throw new Error('Invalid celestial body');
      }
      ids.add(b.id);
      return { id: b.id, name: b.name.trim(), color: b.color, mass: b.mass,
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius,
        custom: Boolean(b.custom), kind: typeof b.kind === 'string' ? b.kind.slice(0, 80) : 'Custom body' };
    });
    if (!ids.has('sun')) throw new Error('A sandbox needs its Sun');
    return { bodies, years: data.years };
  }
  return { G, EARTH_MASS, AU_PER_YEAR_TO_KMS, MAX_BODIES, PLANETS, initialBodies, step, advance, energy, validateSave };
}));
