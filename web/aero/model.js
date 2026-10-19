/* Approximate Keplerian rails + optional live 3D Newtonian gravity. AU, days, solar masses. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AeroModel = factory();
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";
  const AU_KM = 149597870.7,
    EARTH = 3.0034896e-6,
    SOLAR_KG = 1.98847e30;
  const G = (4 * Math.PI * Math.PI) / (365.25 * 365.25);
  const EPOCH = Date.UTC(2026, 9, 19),
    LIMIT = 100;
  const SCENARIOS = [
    ["solar", "Solar System", "Eight planets, dwarf worlds, moons and comets"],
    ["inner", "Inner System", "Mercury to Mars, with the Moon and Ceres"],
    ["giants", "Jupiter & Saturn", "The two gas giants and their major moons"],
    ["outer", "Outer System", "Ice giants, Pluto and distant worlds"],
    ["binary", "Binary Star", "Two suns and three circumbinary planets"],
    ["empty", "Empty Sandbox", "An empty sky: build your own system"],
    [
      "trappist",
      "TRAPPIST-1",
      "Seven Earth-sized worlds around an ultracool dwarf",
    ],
  ];
  const TYPES = {
    star: { label: "Star", mass: 332946, radius: 696340, color: "#ffd079" },
    terrestrial: {
      label: "Terrestrial",
      mass: 1,
      radius: 6371,
      color: "#65b4ff",
    },
    gas: { label: "Gas giant", mass: 317.8, radius: 69911, color: "#d5bd92" },
    ice: { label: "Ice giant", mass: 14.5, radius: 25362, color: "#8fe1e8" },
    dwarf: { label: "Dwarf", mass: 0.0022, radius: 1188, color: "#bcafa2" },
    asteroid: {
      label: "Asteroid",
      mass: 0.00001,
      radius: 80,
      color: "#a7a69e",
    },
    comet: { label: "Comet", mass: 0.00000001, radius: 12, color: "#b7dae8" },
    blackhole: {
      label: "Black hole",
      mass: 332946,
      radius: 3,
      color: "#a195d7",
    },
  };
  function body(name, type, a, mass, radius, color, phase, extra = {}) {
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      type,
      a,
      mass: mass * EARTH,
      radius,
      color,
      phase,
      e: 0,
      inclination: 0,
      node: 0,
      parent: "sun",
      rotation: "—",
      note: "A small world in our celestial neighborhood.",
      live: false,
      custom: false,
      ...extra,
    };
  }
  function catalog() {
    const b = [
      body("Sun", "star", 0, 1 / EARTH, 696340, "#ffd079", 0, {
        parent: null,
        rotation: "25d 9h",
        note: "Our home star. It holds 99.86% of the mass of the solar system.",
      }),
    ];
    b.push(
      body("Mercury", "terrestrial", 0.3871, 0.0553, 2439.7, "#bdb8aa", 3.9, {
        e: 0.2056,
        inclination: 0.122,
        rotation: "58d 15h",
        note: "The smallest planet. A year here lasts just 88 Earth days.",
      }),
      body("Venus", "terrestrial", 0.7233, 0.815, 6051.8, "#e9cf91", 5.7, {
        e: 0.0068,
        inclination: 0.059,
        rotation: "243d",
        note: "A rocky world wrapped in thick clouds, with a scorching surface.",
      }),
      body("Earth", "terrestrial", 1, 1, 6371, "#65b4ff", 6.1, {
        e: 0.0167,
        rotation: "23h 56m",
        note: "The only world known to carry liquid-water oceans and life.",
      }),
      body("Mars", "terrestrial", 1.5237, 0.107, 3389.5, "#d88963", 0.9, {
        e: 0.0934,
        inclination: 0.032,
        rotation: "24h 37m",
        note: "The red planet: a world of dusty deserts, canyons and polar ice.",
      }),
      body("Jupiter", "gas", 5.2026, 317.8, 69911, "#cfb993", 1.82, {
        e: 0.0485,
        inclination: 0.023,
        rotation: "9h 56m",
        note: "A giant of swirling clouds, with a centuries-old storm.",
      }),
      body("Saturn", "gas", 9.5549, 95.16, 58232, "#ddc996", 5.92, {
        e: 0.0555,
        inclination: 0.043,
        rotation: "10h 39m",
        note: "Less dense than water, with a spectacular system of icy rings.",
      }),
      body("Uranus", "ice", 19.2184, 14.54, 25362, "#95dce0", 2.8, {
        e: 0.0463,
        inclination: 0.013,
        rotation: "17h 14m",
        note: "An ice giant tipped onto its side, rolling around the Sun.",
      }),
      body("Neptune", "ice", 30.11, 17.15, 24622, "#718fe0", 4.9, {
        e: 0.009,
        inclination: 0.031,
        rotation: "16h 6m",
        note: "Deep blue, distant, and home to extraordinarily fast winds.",
      }),
      body("Pluto", "dwarf", 39.48, 0.00218, 1188.3, "#c5b4a2", 4.4, {
        e: 0.249,
        inclination: 0.299,
        rotation: "6d 9h",
      }),
      body("Ceres", "dwarf", 2.7675, 0.000157, 469.7, "#adaea1", 3.8, {
        e: 0.076,
        inclination: 0.185,
        rotation: "9h 4m",
        note: "The largest world in the asteroid belt, with hints of a salty interior.",
      }),
    );
    const moons = [
      ["Moon", "earth", 384400, 1737.4, 27.322, "#c7c9c8"],
      ["Phobos", "mars", 9376, 11.3, 0.319, "#aba598"],
      ["Deimos", "mars", 23463, 6.2, 1.263, "#b8b1a1"],
      ["Io", "jupiter", 421700, 1821.6, 1.769, "#d4b35b"],
      ["Europa", "jupiter", 671034, 1560.8, 3.551, "#ccbaa1"],
      ["Ganymede", "jupiter", 1070412, 2634.1, 7.155, "#a8a59b"],
      ["Callisto", "jupiter", 1882709, 2410.3, 16.689, "#7f807b"],
      ["Mimas", "saturn", 185539, 198.2, 0.942, "#aaa9a0"],
      ["Enceladus", "saturn", 238042, 252.1, 1.37, "#d5d8d5"],
      ["Tethys", "saturn", 294672, 531.1, 1.888, "#bdbcb5"],
      ["Dione", "saturn", 377415, 561.4, 2.737, "#b1b7b6"],
      ["Rhea", "saturn", 527068, 763.8, 4.518, "#9d9f9d"],
      ["Titan", "saturn", 1221870, 2574.7, 15.945, "#cba85d"],
      ["Iapetus", "saturn", 3560820, 734.5, 79.32, "#8a8b83"],
      ["Miranda", "uranus", 129390, 235.8, 1.413, "#b5b8b0"],
      ["Ariel", "uranus", 191020, 578.9, 2.52, "#c5c8c1"],
      ["Umbriel", "uranus", 266300, 584.7, 4.144, "#8b9192"],
      ["Titania", "uranus", 435910, 788.9, 8.706, "#acb4b2"],
      ["Oberon", "uranus", 583520, 761.4, 13.463, "#aaa9a4"],
      ["Triton", "neptune", 354759, 1353.4, -5.877, "#c0cfca"],
      ["Charon", "pluto", 19596, 606, 6.387, "#9caaa9"],
    ];
    const moonMassKg = [
      7.342e22, 1.0659e16, 1.4762e15, 8.9319e22, 4.7998e22, 1.4819e23,
      1.0759e23, 3.7493e19, 1.0802e20, 6.1745e20, 1.09545e21, 2.3065e21,
      1.3452e23, 1.8056e21, 6.59e19, 1.353e21, 1.172e21, 3.527e21, 3.014e21,
      2.139e22, 1.586e21,
    ];
    moons.forEach((m, i) =>
      b.push(
        body(
          m[0],
          "moon",
          m[2] / AU_KM,
          moonMassKg[i] / (SOLAR_KG * EARTH),
          m[3],
          m[5],
          i * 1.9,
          {
            parent: m[1],
            period: m[4],
            rotation: Math.abs(m[4]).toFixed(2) + "d",
            note:
              "A natural satellite of " +
              m[1][0].toUpperCase() +
              m[1].slice(1) +
              ".",
          },
        ),
      ),
    );
    [
      ["1I/Oumuamua", 1.28, 0.98, 0.44, 2.4],
      ["Halley", 17.8, 0.967, 2.83, 0.2],
      ["Encke", 2.22, 0.848, 0.21, 4.5],
      ["Tempel 1", 3.12, 0.517, 0.18, 2.2],
    ].forEach((c) =>
      b.push(
        body(c[0], "comet", c[1], 1e-9, 5, "#b4d3df", c[4], {
          e: c[2],
          inclination: c[3],
        }),
      ),
    );
    ["Vesta", "Pallas", "Hygiea", "Eunomia", "Psyche"].forEach((name, i) =>
      b.push(
        body(
          name,
          "asteroid",
          2.36 + i * 0.19,
          0.00001,
          100 + i * 20,
          "#a7a69b",
          1.4 + i * 1.2,
          { e: 0.12, inclination: 0.1 + i * 0.04 },
        ),
      ),
    );
    return b;
  }
  function makeScenario(id = "solar") {
    if (!SCENARIOS.some((s) => s[0] === id))
      throw new Error("Unknown scenario");
    let bodies = catalog();
    const groups = {
      inner: ["sun", "mercury", "venus", "earth", "mars", "ceres"],
      giants: ["sun", "jupiter", "saturn"],
      outer: ["sun", "uranus", "neptune", "pluto"],
    };
    if (groups[id])
      bodies = bodies.filter(
        (b) =>
          groups[id].includes(b.id) ||
          (b.type === "moon" && groups[id].includes(b.parent)),
      );
    if (id === "empty") bodies = [];
    if (id === "trappist") {
      const star = body(
        "TRAPPIST-1",
        "star",
        0,
        0.089 / EARTH,
        84300,
        "#f17d64",
        0,
        {
          parent: null,
          rotation: "3.3d",
          note: "An ultracool red dwarf 40 light-years away, orbited by seven known terrestrial worlds.",
        },
      );
      bodies = [star];
      [
        ["TRAPPIST-1 b", 0.01154, 1.374, 1.116, 1.5109],
        ["TRAPPIST-1 c", 0.0158, 1.308, 1.097, 2.4218],
        ["TRAPPIST-1 d", 0.02227, 0.388, 0.788, 4.0496],
        ["TRAPPIST-1 e", 0.02925, 0.692, 0.92, 6.0996],
        ["TRAPPIST-1 f", 0.03849, 1.039, 1.045, 9.2067],
        ["TRAPPIST-1 g", 0.04683, 1.321, 1.129, 12.3529],
        ["TRAPPIST-1 h", 0.06189, 0.326, 0.755, 18.7729],
      ].forEach(([name, a, mass, radius, period], i) => {
        bodies.push(
          body(
            name,
            "terrestrial",
            a,
            mass,
            radius * 6371,
            [
              "#eaa28a",
              "#dd987b",
              "#a8d6bb",
              "#74cbbd",
              "#7aa6d5",
              "#7e91cf",
              "#d7c2a2",
            ][i],
            0.4 + i * 0.91,
            {
              parent: star.id,
              period,
              note: "A compact, Earth-sized exoplanet. Approximate published orbital period and radius; not an observed ephemeris.",
            },
          ),
        );
      });
    }
    if (id === "binary") {
      bodies = [
        body("Sun", "star", 0.35, 0.65 / EARTH, 510000, "#ffce81", 0, {
          parent: null,
          period: 365.25,
        }),
        body(
          "Companion",
          "star",
          0.65,
          0.35 / EARTH,
          350000,
          "#ff966d",
          Math.PI,
          { parent: null, period: 365.25 },
        ),
        body("Kepler A", "terrestrial", 2.5, 1.5, 7200, "#7cbde0", 0.7),
        body("Kepler B", "terrestrial", 4, 3, 8500, "#b5d998", 2.8),
        body("Kepler C", "ice", 7, 18, 26000, "#bb9ee2", 5.2),
      ];
      bodies.slice(2).forEach((b) => {
        b.parent = null;
        b.period = 365.25 * Math.sqrt(b.a ** 3);
      });
    }
    const state = { version: 2, scenario: id, days: 0, bodies, gravity: false };
    updateRails(state);
    return state;
  }
  function relativePosition(b, days, parentMass = 1) {
    if (!b.a) return { x: 0, y: 0, z: 0 };
    const period =
      b.period || 365.25 * Math.sqrt(b.a ** 3 / Math.max(parentMass, 1e-12));
    const mean = b.phase + (days / period) * 2 * Math.PI;
    let eccentric = mean;
    for (let i = 0; i < 8; i++)
      eccentric -=
        (eccentric - b.e * Math.sin(eccentric) - mean) /
        (1 - b.e * Math.cos(eccentric));
    const x = b.a * (Math.cos(eccentric) - b.e),
      y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(eccentric);
    const ci = Math.cos(b.inclination),
      si = Math.sin(b.inclination),
      cn = Math.cos(b.node),
      sn = Math.sin(b.node);
    return { x: x * cn - y * ci * sn, y: x * sn + y * ci * cn, z: y * si };
  }
  function railPosition(b, days, bodies, depth = 0) {
    if (depth > 4) throw new Error("Invalid parent hierarchy");
    if (b.live && b.pos) return { ...b.pos };
    const parent = bodies.find((p) => p.id === b.parent);
    const p = parent
      ? railPosition(parent, days, bodies, depth + 1)
      : { x: 0, y: 0, z: 0 };
    const r = relativePosition(b, days, parent ? parent.mass : 1);
    return { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
  }
  function updateRails(state) {
    state.bodies.forEach((b) => {
      if (!b.live) b.pos = railPosition(b, state.days, state.bodies);
    });
  }
  function release(state, b) {
    if (b.live) return;
    const p = railPosition(b, state.days, state.bodies),
      future = railPosition(b, state.days + 0.0001, state.bodies);
    b.pos = p;
    b.vel = {
      x: (future.x - p.x) / 0.0001,
      y: (future.y - p.y) / 0.0001,
      z: (future.z - p.z) / 0.0001,
    };
    b.live = true;
  }
  function evolve(state, days) {
    if (!Number.isFinite(days) || days < 0 || days > 20)
      throw new Error("Invalid time step");
    const live = state.bodies.filter((b) => b.live);
    if (!live.length) {
      state.days += days;
      updateRails(state);
      return;
    }
    // Compact live orbits (especially moons and close-in exoplanets) demand smaller steps. Cap work and slow time rather than skipping steps.
    let h = 0.25;
    live.forEach((b) => {
      if (Number.isFinite(b.period) && b.period !== 0) {
        h = Math.min(h, Math.abs(b.period) / 80);
      }
    });
    const actual = Math.min(days, h * 200),
      n = Math.max(1, Math.ceil(actual / h));
    h = actual / n;
    function acceleration(b) {
      const a = { x: 0, y: 0, z: 0 };
      state.bodies.forEach((source) => {
        if (source === b) return;
        const dx = source.pos.x - b.pos.x,
          dy = source.pos.y - b.pos.y,
          dz = source.pos.z - b.pos.z;
        const r2 = dx * dx + dy * dy + dz * dz + 1e-12,
          f = (G * source.mass) / (r2 * Math.sqrt(r2));
        a.x += dx * f;
        a.y += dy * f;
        a.z += dz * f;
      });
      return a;
    }
    for (let i = 0; i < n; i++) {
      const first = live.map(acceleration);
      live.forEach((b, j) =>
        ["x", "y", "z"].forEach((k) => {
          b.vel[k] += (first[j][k] * h) / 2;
          b.pos[k] += b.vel[k] * h;
        }),
      );
      state.days += h;
      updateRails(state);
      const second = live.map(acceleration);
      live.forEach((b, j) =>
        ["x", "y", "z"].forEach((k) => {
          b.vel[k] += (second[j][k] * h) / 2;
        }),
      );
    }
  }
  function addBody(state, options) {
    if (state.bodies.length >= LIMIT) throw new Error("Maximum 100 bodies");
    const t = Object.prototype.hasOwnProperty.call(TYPES, options.type)
      ? TYPES[options.type]
      : null;
    if (
      !t ||
      !Number.isFinite(options.mass) ||
      options.mass < 1e-10 ||
      options.mass > 1e7 ||
      !Number.isFinite(options.radius) ||
      options.radius < 1 ||
      options.radius > 1e7 ||
      !Number.isFinite(options.a) ||
      options.a < 0.05 ||
      options.a > 200
    )
      throw new Error("Invalid body properties");
    const parent = state.bodies.find((b) => b.type === "star");
    const b = body(
      String(
        options.name ||
          t.label + " " + (state.bodies.filter((b) => b.custom).length + 1),
      ).slice(0, 40),
      options.type,
      options.a,
      options.mass,
      options.radius,
      t.color,
      options.phase || 0.6,
      {
        id:
          "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        parent: parent ? parent.id : null,
        custom: true,
        note: "Created by you. Integrated live under Newtonian gravity.",
        e: options.type === "comet" ? 0.65 : 0,
      },
    );
    if (!parent && (options.type === "star" || options.type === "blackhole"))
      b.a = 0;
    state.bodies.push(b);
    updateRails(state);
    release(state, b);
    return b;
  }
  function validateSave(input) {
    if (
      !input ||
      input.version !== 2 ||
      !SCENARIOS.some((s) => s[0] === input.scenario) ||
      !Number.isFinite(input.days) ||
      Math.abs(input.days) > 3652500 ||
      !Array.isArray(input.bodies) ||
      input.bodies.length > LIMIT
    )
      throw new Error("Invalid simulator save");
    const ids = new Set();
    const bodies = input.bodies.map((b) => {
      if (
        !b ||
        typeof b.id !== "string" ||
        b.id.length > 90 ||
        ids.has(b.id) ||
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 40 ||
        !(
          Object.prototype.hasOwnProperty.call(TYPES, b.type) ||
          b.type === "moon"
        ) ||
        !/^#[a-f0-9]{6}$/i.test(b.color) ||
        !["a", "mass", "radius", "phase", "e", "inclination", "node"].every(
          (k) => Number.isFinite(b[k]),
        ) ||
        b.a < 0 ||
        b.a > 200 ||
        b.mass <= 0 ||
        b.mass > 100 ||
        b.radius <= 0 ||
        b.radius > 1e7 ||
        b.e < 0 ||
        b.e >= 0.999 ||
        (b.period !== undefined &&
          (!Number.isFinite(b.period) ||
            Math.abs(b.period) < 1e-6 ||
            Math.abs(b.period) > 1e8)) ||
        (b.parent !== null && typeof b.parent !== "string") ||
        !b.pos ||
        !["x", "y", "z"].every(
          (k) => Number.isFinite(b.pos[k]) && Math.abs(b.pos[k]) < 1e8,
        ) ||
        (b.live &&
          (!b.vel ||
            !["x", "y", "z"].every(
              (k) => Number.isFinite(b.vel[k]) && Math.abs(b.vel[k]) < 1e6,
            )))
      )
        throw new Error("Invalid body in save");
      ids.add(b.id);
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        a: b.a,
        mass: b.mass,
        radius: b.radius,
        color: b.color,
        phase: b.phase,
        e: b.e,
        inclination: b.inclination,
        node: b.node,
        parent: b.parent,
        period: b.period,
        pos: { ...b.pos },
        vel: b.live ? { ...b.vel } : undefined,
        live: Boolean(b.live),
        custom: Boolean(b.custom),
        note: String(b.note || "").slice(0, 300),
        rotation: String(b.rotation || "—").slice(0, 30),
      };
    });
    const state = {
      version: 2,
      scenario: input.scenario,
      days: input.days,
      gravity: Boolean(input.gravity),
      bodies,
    };
    bodies.forEach((b) => {
      if (b.parent !== null && !ids.has(b.parent))
        throw new Error("Missing parent");
      railPosition({ ...b, live: false }, state.days, bodies);
    });
    updateRails(state);
    return state;
  }
  return {
    AU_KM,
    EARTH,
    SOLAR_KG,
    G,
    EPOCH,
    LIMIT,
    SCENARIOS,
    TYPES,
    catalog,
    makeScenario,
    relativePosition,
    railPosition,
    updateRails,
    release,
    evolve,
    addBody,
    validateSave,
  };
});
