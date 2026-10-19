const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../web/aero/model.js");

test("Aero starts with 41 bodies and real parent-linked satellite counts", () => {
  const s = M.makeScenario();
  assert.equal(s.bodies.length, 41);
  assert.equal(
    s.bodies.filter((b) => b.type === "moon" && b.parent === "saturn").length,
    7,
  );
  assert.equal(
    s.bodies.filter((b) => b.type === "moon" && b.parent === "earth").length,
    1,
  );
  s.bodies.forEach((b) =>
    assert.ok(["x", "y", "z"].every((k) => Number.isFinite(b.pos[k]))),
  );
});
test("all scenarios are valid and deterministic", () => {
  M.SCENARIOS.forEach(([id]) => {
    const a = M.makeScenario(id),
      b = M.makeScenario(id);
    assert.deepEqual(a, b);
    assert.equal(
      M.validateSave(JSON.parse(JSON.stringify(a))).bodies.length,
      a.bodies.length,
    );
  });
  const trappist = M.makeScenario("trappist");
  assert.equal(trappist.bodies.length, 8);
  assert.equal(
    trappist.bodies.filter((b) => b.parent === "trappist-1").length,
    7,
  );
  assert.ok(trappist.bodies.every((b) => Number.isFinite(b.pos.x)));
  assert.throws(() => M.makeScenario("invalid"));
});
test("Kepler solver places Earth back at its start after one approximate year", () => {
  const s = M.makeScenario(),
    earth = s.bodies.find((b) => b.id === "earth");
  const start = { ...earth.pos };
  s.days = 365.25;
  M.updateRails(s);
  assert.ok(Math.hypot(earth.pos.x - start.x, earth.pos.y - start.y) < 1e-12);
});
test("moon stays at its physical orbital distance from its parent", () => {
  const s = M.makeScenario(),
    earth = s.bodies.find((b) => b.id === "earth"),
    moon = s.bodies.find((b) => b.id === "moon");
  for (let i = 0; i < 10; i++) {
    M.evolve(s, 10);
    assert.ok(
      Math.abs(
        Math.hypot(
          moon.pos.x - earth.pos.x,
          moon.pos.y - earth.pos.y,
          moon.pos.z - earth.pos.z,
        ) *
          M.AU_KM -
          384400,
      ) < 1e-6,
    );
  }
});
test("custom worlds use live gravity while the catalog stays on rails", () => {
  const s = M.makeScenario();
  const world = M.addBody(s, {
    name: "Test",
    type: "terrestrial",
    mass: 1,
    radius: 6371,
    a: 1.5,
  });
  assert.equal(world.live, true);
  assert.equal(s.bodies[3].live, false);
  const start = { ...world.pos };
  M.evolve(s, 1);
  assert.ok(Math.hypot(world.pos.x - start.x, world.pos.y - start.y) > 0.001);
  assert.ok(["x", "y", "z"].every((k) => Number.isFinite(world.vel[k])));
});
test("compact TRAPPIST-1 periods are resolved with adaptive gravity steps", () => {
  const s = M.makeScenario("trappist");
  s.bodies
    .filter((b) => b.type === "terrestrial")
    .forEach((b) => M.release(s, b));
  for (let i = 0; i < 40; i++) M.evolve(s, 0.05);
  assert.ok(s.days > 1.99);
  s.bodies.forEach((b) =>
    ["x", "y", "z"].forEach((k) => assert.ok(Number.isFinite(b.pos[k]))),
  );
});
test("released primaries and released moons advance without nonfinite values", () => {
  const s = M.makeScenario("inner");
  s.bodies.forEach((b) => M.release(s, b));
  for (let i = 0; i < 30; i++) M.evolve(s, 0.05);
  assert.ok(s.days > 1);
  s.bodies.forEach((b) =>
    ["x", "y", "z"].forEach((k) => assert.ok(Number.isFinite(b.pos[k]))),
  );
});
test("all eight body types work in empty space and reject invalid inputs", () => {
  const s = M.makeScenario("empty");
  Object.entries(M.TYPES).forEach(([type, t]) =>
    M.addBody(s, { type, mass: t.mass, radius: t.radius, a: 2 }),
  );
  assert.equal(s.bodies.length, 8);
  assert.equal(s.bodies[0].a, 0);
  const good = { type: "terrestrial", mass: 1, radius: 6000, a: 1 };
  [
    { ...good, type: "__proto__" },
    { ...good, mass: NaN },
    { ...good, a: 0 },
    { ...good, radius: -1 },
  ].forEach((p) => assert.throws(() => M.addBody(s, p)));
  [NaN, -1, 30].forEach((dt) => assert.throws(() => M.evolve(s, dt)));
});
test("Aero save validation rejects nonfinite values, duplicate IDs and parent cycles", () => {
  const make = () => JSON.parse(JSON.stringify(M.makeScenario()));
  const good = make();
  assert.equal(M.validateSave(good).bodies.length, 41);
  const broken = make();
  broken.bodies[2].mass = Infinity;
  const duplicate = make();
  duplicate.bodies[2].id = duplicate.bodies[1].id;
  const cycle = make();
  cycle.bodies[0].parent = "earth";
  const missing = make();
  missing.bodies[3].parent = "nonexistent";
  const unsafe = make();
  unsafe.bodies[1].color = "url(https://example.com)";
  [broken, duplicate, cycle, missing, unsafe].forEach((s) =>
    assert.throws(() => M.validateSave(s)),
  );
});
