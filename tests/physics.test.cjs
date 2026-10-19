'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../web/physics.js');

test('starts with the Sun and eight planets in AU and solar masses', () => {
  const b = P.initialBodies();
  assert.equal(b.length, 9);
  assert.equal(b[0].mass, 1);
  const earth = b.find(x => x.id === 'earth');
  assert.ok(Math.abs(Math.hypot(earth.x, earth.y) - 1) < 1e-12);
  assert.equal(earth.mass, P.EARTH_MASS);
});

test('gravity is pairwise and conserves linear momentum', () => {
  const b = P.initialBodies();
  const momentum = axis => b.reduce((s, x) => s + x.mass * x[axis], 0);
  const px = momentum('vx'), py = momentum('vy');
  for (let i = 0; i < 1000; i++) P.step(b, 0.001);
  assert.ok(Math.abs(momentum('vx') - px) < 1e-15);
  assert.ok(Math.abs(momentum('vy') - py) < 1e-15);
});

test('Earth completes approximately one orbit in a year', () => {
  const bodies = P.initialBodies().filter(b => ['sun', 'earth'].includes(b.id));
  const earth = bodies[1], sun = bodies[0];
  const start = Math.atan2(earth.y - sun.y, earth.x - sun.x);
  for (let i = 0; i < 1000; i++) P.step(bodies, 0.001);
  const end = Math.atan2(earth.y - sun.y, earth.x - sun.x);
  assert.ok(Math.abs(end - start) < 0.001);
  assert.ok(Math.abs(Math.hypot(earth.x - sun.x, earth.y - sun.y) - 1) < 0.0001);
});

test('symplectic integrator keeps energy bounded over ten years', () => {
  const bodies = P.initialBodies(), initial = P.energy(bodies);
  for (let i = 0; i < 10000; i++) P.step(bodies, 0.001);
  assert.ok(Math.abs((P.energy(bodies) - initial) / initial) < 0.0001);
  bodies.forEach(b => assert.ok(['x', 'y', 'vx', 'vy'].every(k => Number.isFinite(b[k]))));
});

test('softening prevents division by zero for overlapping bodies', () => {
  const bodies = P.initialBodies().slice(0, 2);
  bodies[1].x = 0; bodies[1].y = 0;
  P.step(bodies, 0.001);
  bodies.forEach(b => assert.ok(Number.isFinite(b.vx) && Number.isFinite(b.x)));
});

test('advance rejects invalid intervals and advances deterministic substeps', () => {
  const a = P.initialBodies(), b = P.initialBodies();
  P.advance(a, 0.01);
  for (let i = 0; i < 10; i++) P.step(b, 0.001);
  assert.deepEqual(a, b);
  [NaN, Infinity, -1, 5].forEach(dt => assert.throws(() => P.advance(a, dt)));
});

test('valid saves round-trip and ignore extraneous properties', () => {
  const data = { version: 1, bodies: P.initialBodies(), years: 12.5 };
  const loaded = P.validateSave(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(loaded.bodies, data.bodies);
  assert.equal(loaded.years, data.years);
});

test('invalid or malicious save data is rejected atomically', () => {
  const save = () => ({ version: 1, bodies: P.initialBodies(), years: 0 });
  assert.throws(() => P.validateSave(null));
  const badVersion = save(); badVersion.version = 2;
  const negativeMass = save(); negativeMass.bodies[1].mass = -1;
  const unsafeColor = save(); unsafeColor.bodies[1].color = 'url(https://example.com)';
  const duplicate = save(); duplicate.bodies[1].id = 'sun';
  const missingSun = save(); missingSun.bodies.shift();
  const invalidTime = save(); invalidTime.years = Infinity;
  const hugePosition = save(); hugePosition.bodies[1].x = 1e20;
  const tooMany = save(); tooMany.bodies = Array.from({ length: 41 }, () => save().bodies[0]);
  [badVersion, negativeMass, unsafeColor, duplicate, missingSun, invalidTime, hugePosition, tooMany]
    .forEach(data => assert.throws(() => P.validateSave(data)));
});
