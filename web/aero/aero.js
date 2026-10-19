(() => {
  "use strict";
  const M = window.AeroModel,
    $ = (id) => document.getElementById(id);
  const canvas = $("universe"),
    ctx = canvas.getContext("2d");
  let state = M.makeScenario(),
    selected = "earth",
    tab = "inspect";
  let playing = true,
    rate = 1,
    width = 1,
    height = 1,
    scale = 46,
    zoom = 1;
  let pan = { x: 0, y: 0 },
    yaw = 0,
    pitch = 0.24,
    tracking = "",
    theme = "night",
    pack = "theme";
  let last = 0,
    uiTime = 0,
    trailTime = 0,
    notifyTimer,
    confirmAction;
  let trails = new Map(),
    textures = new Map(),
    orbitPaths = new Map(),
    stars = [],
    hits = [],
    hover = "";
  const pointers = new Map();
  let drag = null,
    pinch = null;
  const view = {
    orbits: true,
    labels: true,
    trails: true,
    moons: true,
    fade: false,
    "moon-names": false,
    "show-sun": true,
    axes: false,
    "true-scale": false,
  };
  const themes = [
    ["night", "Aero Night", "Blue glass over deep space", "#142238", "#579df4"],
    [
      "day",
      "Aero Day",
      "Light glass and a blueprint-style chart",
      "#dbe7f5",
      "#2c7dd6",
    ],
    [
      "luna",
      "Luna Blue",
      "XP-era blue chrome with cream panels",
      "#e7e2d3",
      "#1556b5",
    ],
    [
      "aurora",
      "Aurora",
      "Teal and violet over polar night",
      "#183241",
      "#3ed7bb",
    ],
    [
      "contrast",
      "High Contrast",
      "Black, white and yellow",
      "#000000",
      "#ffff00",
    ],
  ];
  const builtinParts = [
    { name: "Ember", type: "terrestrial", mass: 0.0553, radius: 2500, a: 0.8 },
    {
      name: "Ocean World",
      type: "terrestrial",
      mass: 1,
      radius: 6371,
      a: 1.51,
    },
    { name: "Ringed Ice Giant", type: "ice", mass: 14.54, radius: 25362, a: 7 },
  ];
  let satelliteKey = "";
  let parts = builtinParts.map((p) => ({ ...p }));
  function loadParts() {
    try {
      const data = JSON.parse(localStorage.getItem("aero-parts-v2"));
      if (Array.isArray(data) && data.length <= 30) {
        const test = M.makeScenario("empty");
        data.forEach((p) => {
          M.addBody(test, p);
          test.bodies = [];
        });
        parts = data.map((p) => ({
          name: String(p.name).slice(0, 40),
          type: p.type,
          mass: p.mass,
          radius: p.radius,
          a: p.a,
        }));
      }
    } catch (_) {
      /* Corrupt optional library does not prevent launch. */
    }
  }
  loadParts();
  function saveParts() {
    try {
      localStorage.setItem("aero-parts-v2", JSON.stringify(parts));
      return true;
    } catch (_) {
      notify("Device storage is unavailable. Library was not saved.");
      return false;
    }
  }
  function notify(message) {
    $("notification").textContent = message;
    $("notification").hidden = false;
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      $("notification").hidden = true;
    }, 3200);
  }
  function confirm(title, action) {
    confirmAction = action;
    $("confirm-title").textContent = title;
    $("confirm-dialog").showModal();
  }
  function selectedBody() {
    return state.bodies.find((b) => b.id === selected);
  }
  function switchTab(id) {
    tab = id;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === id);
      b.setAttribute("aria-selected", String(b.dataset.tab === id));
    });
    ["inspect", "create", "library"].forEach((t) => {
      $(t + "-panel").hidden = t !== id;
    });
    if (id === "library") renderLibrary();
  }
  function setPlaying(value) {
    playing = value;
    $("play").textContent = value ? "Ⅱ" : "▶";
    $("play").setAttribute(
      "aria-label",
      value ? "Pause simulation" : "Resume simulation",
    );
    updateUI();
  }
  function setZoom(value) {
    zoom = Math.min(30000, Math.max(0.08, value));
  }
  function resetCamera() {
    tracking = "";
    pan = { x: 0, y: 0 };
    setZoom(1);
    yaw = 0;
    pitch = 0.24;
    updateTracking();
  }
  function updateTracking() {
    const b = state.bodies.find((b) => b.id === tracking);
    $("tracking-badge").hidden = !b;
    $("tracking-badge").querySelector("span").textContent = b ? b.name : "";
    $("auto-track").value = tracking;
    $("follow").textContent =
      b && b.id === selected ? "∞ Following" : "∞ Follow";
    $("follow").setAttribute(
      "aria-pressed",
      String(Boolean(b && b.id === selected)),
    );
  }
  function setTracking(id) {
    tracking = id;
    pan = { x: 0, y: 0 };
    updateTracking();
  }
  function select(id, show = true) {
    if (!state.bodies.some((b) => b.id === id)) return;
    selected = id;
    $("body-select").value = id;
    updateInspector();
    updateTracking();
    if (show) {
      switchTab("inspect");
      if (window.innerWidth <= 650) $("sidebar").classList.add("open");
    }
  }
  function rebuildSelectors() {
    const previous = {
      "auto-track": tracking,
      "measure-a": $("measure-a").value,
      "measure-b": $("measure-b").value,
    };
    ["body-select", "auto-track", "measure-a", "measure-b"].forEach((id) => {
      const selectEl = $(id);
      selectEl.replaceChildren();
      if (id === "auto-track") selectEl.add(new Option("Free camera", ""));
      state.bodies.forEach((b) => selectEl.add(new Option(b.name, b.id)));
      selectEl.value = id === "body-select" ? selected : previous[id];
      if (selectEl.selectedIndex < 0 && selectEl.options.length)
        selectEl.selectedIndex = 0;
    });
    if (
      !$("measure-b").value ||
      $("measure-b").value === $("measure-a").value
    ) {
      if (state.bodies.some((b) => b.id === "earth"))
        $("measure-b").value = "earth";
      else if (state.bodies.length > 1) $("measure-b").selectedIndex = 1;
    }
    updateTracking();
  }
  function loadScenario(id) {
    state = M.makeScenario(id);
    trails.clear();
    orbitPaths.clear();
    selected = state.bodies.some((b) => b.id === "earth")
      ? "earth"
      : state.bodies[0]?.id || "";
    resetCamera();
    if (id === "inner") setZoom(3);
    if (id === "outer") setZoom(0.35);
    $("scenario").value = id;
    rebuildSelectors();
    renderScenarios();
    updateInspector();
    updateUI();
    notify("Scenario: " + M.SCENARIOS.find((s) => s[0] === id)[1]);
  }
  function requestScenario(id) {
    if (state.bodies.some((b) => b.custom))
      confirm("Replace this experiment?", () => loadScenario(id));
    else loadScenario(id);
  }
  function formatMass(mass) {
    return (mass * M.SOLAR_KG).toExponential(2).replace("e+", "e") + " kg";
  }
  function distance(a, b = { x: 0, y: 0, z: 0 }) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  function updateInspector() {
    const b = selectedBody(),
      enabled = Boolean(b);
    ["focus", "follow", "release", "remove", "save-part"].forEach((id) => {
      $(id).disabled = !enabled;
    });
    if (!b) {
      $("body-name").textContent = "Empty sky";
      $("body-type").textContent = "Create a world to get started";
      [
        "body-distance",
        "body-period",
        "body-rotation",
        "body-radius",
        "body-mass",
      ].forEach((id) => {
        $(id).textContent = "—";
      });
      $("body-note").textContent =
        "Your next universe starts in the Create tab.";
      $("satellite-list").replaceChildren();
      satelliteKey = "";
      $("moon-count").textContent = "0 moons";
      return;
    }
    const parent = state.bodies.find((p) => p.id === b.parent);
    const d = distance(b.pos, parent?.pos);
    $("body-dot").style.background = b.color;
    $("body-dot").style.boxShadow = "0 0 0 3px " + b.color + "33";
    $("body-name").textContent = b.name;
    $("body-type").textContent =
      (M.TYPES[b.type]?.label || "Natural satellite") +
      (["terrestrial", "gas", "ice", "dwarf"].includes(b.type)
        ? " planet"
        : "") +
      (b.live ? " · live gravity" : "");
    $("body-distance").textContent =
      d.toFixed(b.type === "moon" ? 5 : 3) + " AU";
    const period = Math.abs(
      b.period ||
        (b.a ? 365.25 * Math.sqrt(b.a ** 3 / (parent?.mass || 1)) : 0),
    );
    $("body-period").textContent = !period
      ? "—"
      : period > 100
        ? (period / 365.25).toFixed(2) + "y"
        : period.toFixed(2) + "d";
    $("body-rotation").textContent = b.rotation;
    $("body-radius").textContent =
      Math.round(b.radius).toLocaleString("en-US") + " km";
    $("body-mass").textContent = formatMass(b.mass);
    $("body-note").textContent = b.note;
    $("body-note").style.borderColor = b.color;
    $("release").textContent = b.live
      ? "◌ Live gravity"
      : "◌ Release to gravity";
    $("release").disabled = b.live;
    const moons = state.bodies.filter(
      (m) => m.parent === b.id && m.type === "moon",
    );
    $("moon-count").textContent =
      moons.length + (moons.length === 1 ? " moon" : " moons");
    const nextSatelliteKey = b.id + ":" + moons.map((m) => m.id).join(",");
    if (satelliteKey === nextSatelliteKey) return;
    satelliteKey = nextSatelliteKey;
    $("satellite-list").replaceChildren();
    moons.forEach((m) => {
      const button = document.createElement("button");
      button.className = "satellite-row";
      button.append(document.createTextNode(m.name));
      const small = document.createElement("small");
      small.textContent = Math.round(m.radius) + " km";
      button.append(small);
      button.addEventListener("click", () => select(m.id));
      $("satellite-list").append(button);
    });
  }
  function updateUI() {
    const date = new Date(M.EPOCH + state.days * 86400000);
    $("epoch").textContent =
      date
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
        .toUpperCase() +
      " " +
      date.toISOString().slice(11, 16);
    $("scene-name").textContent = M.SCENARIOS.find(
      (s) => s[0] === state.scenario,
    )[1];
    $("scene-count").textContent = state.bodies.length + " bodies";
    $("status").textContent =
      state.bodies.length +
      " bodies · " +
      (state.bodies.some((b) => b.live)
        ? "live gravity + rails"
        : "orbital rails") +
      " · " +
      (playing ? "running" : "paused");
    $("gravity").textContent = "◌ Gravity " + (state.gravity ? "on" : "off");
    $("gravity").setAttribute("aria-pressed", String(state.gravity));
    const a = state.bodies.find((b) => b.id === $("measure-a").value),
      b = state.bodies.find((b) => b.id === $("measure-b").value);
    const d = a && b ? distance(a.pos, b.pos) : 0;
    $("separation-au").textContent = d.toFixed(4) + " AU";
    $("separation-km").textContent =
      ((d * M.AU_KM) / 1e6).toFixed(3) + " million km";
    if (tab === "inspect") updateInspector();
    let scaleAU = 93 / (scale * zoom),
      power = 10 ** Math.floor(Math.log10(scaleAU));
    scaleAU = Math.round(scaleAU / power) * power;
    $("scale-label").textContent =
      scaleAU < 0.001
        ? (scaleAU * M.AU_KM).toFixed(0) + " km"
        : Number(scaleAU.toPrecision(2)) + " AU";
    document.querySelector(".scale-bar").style.width =
      Math.min(130, Math.max(20, scaleAU * scale * zoom)) + "px";
  }
  function renderScenarios() {
    $("scenario-list").replaceChildren();
    M.SCENARIOS.forEach(([id, name, desc]) => {
      const button = document.createElement("button");
      button.className =
        "scenario-option" + (state.scenario === id ? " active" : "");
      const text = document.createElement("span"),
        strong = document.createElement("strong"),
        small = document.createElement("small");
      strong.textContent = name;
      small.textContent = desc;
      text.append(strong, small);
      button.append(text);
      button.addEventListener("click", () => requestScenario(id));
      $("scenario-list").append(button);
    });
  }
  let createType = "terrestrial";
  function setType(type) {
    createType = type;
    const t = M.TYPES[type];
    document
      .querySelectorAll("[data-type]")
      .forEach((b) => b.classList.toggle("active", b.dataset.type === type));
    $("mass").value = Math.log10(t.mass);
    $("radius").value = Math.log10(t.radius);
    updateCreation();
  }
  function updateCreation() {
    document.querySelectorAll("input[type=range]").forEach((el) => {
      el.style.setProperty(
        "--fill",
        ((Number(el.value) - Number(el.min)) /
          (Number(el.max) - Number(el.min))) *
          100 +
          "%",
      );
    });
    const mass = 10 ** Number($("mass").value),
      radius = 10 ** Number($("radius").value),
      a = 10 ** Number($("orbit-radius").value);
    $("mass-output").textContent =
      (mass < 0.01 ? mass.toExponential(2) : mass.toFixed(2)) + "× Earth";
    $("mass-kg").textContent = formatMass(mass * M.EARTH);
    $("radius-output").textContent =
      Math.round(radius).toLocaleString("en-US") + " km";
    $("orbit-output").textContent = a.toFixed(2) + " AU";
    const parent = state.bodies.find((b) => b.type === "star");
    $("orbit-period").textContent =
      Math.sqrt(a ** 3 / (parent?.mass || 1)).toFixed(2) + "y";
  }
  function add(options) {
    try {
      const b = M.addBody(state, options);
      selected = b.id;
      rebuildSelectors();
      select(b.id, false);
      notify(b.name + " added · live gravity");
      updateUI();
      return b;
    } catch (error) {
      notify(error.message);
    }
  }
  function renderLibrary() {
    $("part-list").replaceChildren();
    parts.forEach((p, index) => {
      const row = document.createElement("button");
      row.className = "library-row";
      row.dataset.part = String(index);
      const dot = document.createElement("span");
      dot.className = "pack-swatch";
      dot.style.background = M.TYPES[p.type].color;
      dot.style.borderRadius = "50%";
      const text = document.createElement("span"),
        name = document.createElement("strong"),
        detail = document.createElement("small"),
        use = document.createElement("em");
      name.textContent = p.name;
      detail.textContent =
        M.TYPES[p.type].label + " · " + formatMass(p.mass * M.EARTH);
      use.textContent = "USE";
      text.append(name, detail);
      row.append(dot, text, use);
      row.addEventListener("click", () => {
        add({ ...p, phase: Math.random() * Math.PI * 2 });
      });
      $("part-list").append(row);
    });
    $("library-count").textContent =
      parts.length + " PARTS · 2 COLOUR PACKS · 1 SCENARIO";
    $("pack-list").replaceChildren();
    [
      ["theme", "Theme colours", "Original procedural surfaces", "#8196b6"],
      ["blue", "Deep Blue", "Cold starlight · 45%", "#579dff"],
      ["dust", "Warm Dusk", "Amber light · 35%", "#ffb469"],
    ].forEach(([id, name, desc, color]) => {
      const row = document.createElement("button");
      row.className = "library-row" + (pack === id ? " active" : "");
      row.dataset.pack = id;
      const dot = document.createElement("span");
      dot.className = "pack-swatch";
      dot.style.background = color;
      const text = document.createElement("span"),
        strong = document.createElement("strong"),
        small = document.createElement("small"),
        on = document.createElement("em");
      strong.textContent = name;
      small.textContent = desc;
      on.textContent = pack === id ? "ON" : "";
      text.append(strong, small);
      row.append(dot, text, on);
      row.addEventListener("click", () => {
        pack = id;
        renderLibrary();
        notify("Colour pack: " + name);
      });
      $("pack-list").append(row);
    });
  }
  function setTheme(id, announce = true) {
    theme = id;
    document.body.dataset.theme = id;
    $("theme-name").textContent = themes
      .find((t) => t[0] === id)[1]
      .toUpperCase();
    document.querySelectorAll("[data-theme-choice]").forEach((el) => {
      el.classList.toggle("active", el.dataset.themeChoice === id);
      el.querySelector(".theme-check").textContent =
        el.dataset.themeChoice === id ? "✓" : "";
    });
    try {
      localStorage.setItem("aero-theme", id);
    } catch (_) {
      /* Optional preference. */
    }
    if (announce) notify("Theme: " + themes.find((t) => t[0] === id)[1]);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width / 21, height / 14);
    if (window.innerWidth <= 650) scale = Math.min(width / 12, height / 15);
    let seed = 10497;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    stars = Array.from({ length: Math.round((width * height) / 1500) }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: rand() * 0.9 + 0.25,
      a: 0.2 + rand() * 0.5,
      warm: rand() > 0.75,
    }));
  }
  new ResizeObserver(resize).observe(canvas);
  function rotate(p) {
    const x = p.x * Math.cos(yaw) - p.y * Math.sin(yaw),
      y = p.x * Math.sin(yaw) + p.y * Math.cos(yaw);
    return {
      x,
      y: y * Math.cos(pitch) - p.z * Math.sin(pitch),
      z: y * Math.sin(pitch) + p.z * Math.cos(pitch),
    };
  }
  function screen(p) {
    const target = state.bodies.find((b) => b.id === tracking)?.pos || {
      x: 0,
      y: 0,
      z: 0,
    };
    const v = rotate({
      x: p.x - target.x,
      y: p.y - target.y,
      z: p.z - target.z,
    });
    return {
      x: width / 2 + pan.x + v.x * scale * zoom,
      y: height / 2 + pan.y - v.y * scale * zoom,
      z: v.z,
    };
  }
  function displayRadius(b) {
    if (view["true-scale"])
      return Math.max(0.8, Math.min(1000, (b.radius / M.AU_KM) * scale * zoom));
    const base =
      b.type === "star"
        ? 12
        : b.type === "moon"
          ? Math.max(2, Math.min(4, b.radius / 700))
          : b.type === "gas"
            ? 18
            : b.type === "ice"
              ? 12
              : b.type === "blackhole"
                ? 10
                : ["asteroid", "comet"].includes(b.type)
                  ? 2.6
                  : b.type === "dwarf"
                    ? 3.5
                    : 6;
    return Math.min(
      b.type === "moon" ? 14 : 88,
      base * Math.max(0.6, Math.pow(zoom, 0.29)),
    );
  }
  function bodyScreen(b) {
    if (b.type !== "moon" || view["true-scale"] || b.live) return screen(b.pos);
    const parent = state.bodies.find((p) => p.id === b.parent);
    if (!parent) return screen(b.pos);
    const ps = screen(parent.pos),
      ms = screen(b.pos),
      dx = ms.x - ps.x,
      dy = ms.y - ps.y;
    const index = state.bodies
      .filter((m) => m.type === "moon" && m.parent === b.parent)
      .findIndex((m) => m.id === b.id);
    const minOrbit = displayRadius(parent) + 5 + index * 2.2;
    const actual = Math.hypot(dx, dy),
      factor = actual < minOrbit ? minOrbit / Math.max(actual, 0.000001) : 1;
    return { x: ps.x + dx * factor, y: ps.y + dy * factor, z: ms.z };
  }
  function texture(b) {
    const key = b.id + b.color;
    if (textures.has(key)) return textures.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = 192;
    const t = c.getContext("2d");
    t.fillStyle = b.color;
    t.fillRect(0, 0, 192, 192);
    let seed = 1;
    for (const ch of b.id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    if (b.type === "gas" || b.type === "ice") {
      for (let y = 0; y < 192; y += 3) {
        t.fillStyle = y % 17 < 8 ? "#493e3045" : "#fff1ca35";
        const h = 3 + rand() * 10;
        t.fillRect(0, y, 192, h);
      }
      if (b.id === "jupiter") {
        t.fillStyle = "#b96749";
        t.beginPath();
        t.ellipse(126, 115, 18, 8, 0, 0, 7);
        t.fill();
      }
    } else if (b.id === "earth" || b.name === "Ocean World") {
      t.fillStyle = "#468fd2";
      t.fillRect(0, 0, 192, 192);
      for (let i = 0; i < 15; i++) {
        t.fillStyle = i % 2 ? "#85a883" : "#a9b78b";
        const x = rand() * 192,
          y = rand() * 180;
        t.beginPath();
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2,
            r = 7 + rand() * 17;
          t.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        t.closePath();
        t.fill();
      }
      t.strokeStyle = "#f5ffff60";
      t.lineWidth = 4;
      for (let i = 0; i < 9; i++) {
        t.beginPath();
        t.ellipse(rand() * 192, rand() * 192, 30, 4, -0.3, 0, Math.PI);
        t.stroke();
      }
    } else {
      for (let i = 0; i < 65; i++) {
        const x = rand() * 192,
          y = rand() * 192,
          r = 2 + rand() * 15;
        t.fillStyle = i % 2 ? "#ffffff13" : "#22201926";
        t.beginPath();
        t.arc(x, y, r, 0, 7);
        t.fill();
        t.strokeStyle = "#fff9df18";
        t.lineWidth = 0.8;
        t.stroke();
      }
    }
    textures.set(key, c);
    return c;
  }
  function drawBody(b, p) {
    const r = displayRadius(b);
    if (
      p.x < -r * 3 ||
      p.x > width + r * 3 ||
      p.y < -r * 3 ||
      p.y > height + r * 3
    )
      return;
    if (b.type === "star" || b.type === "blackhole") {
      const glow = ctx.createRadialGradient(
        p.x,
        p.y,
        r * 0.5,
        p.x,
        p.y,
        r * 2.8,
      );
      glow.addColorStop(0, b.color + "70");
      glow.addColorStop(1, b.color + "00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.8, 0, 7);
      ctx.fill();
    }
    if (b.type === "comet") {
      const sun = state.bodies.find((s) => s.type === "star");
      const sp = sun ? screen(sun.pos) : { x: width / 2, y: height / 2 };
      const angle = Math.atan2(p.y - sp.y, p.x - sp.x),
        length = Math.min(100, 20 + zoom * 6);
      const tail = ctx.createLinearGradient(
        p.x,
        p.y,
        p.x + Math.cos(angle) * length,
        p.y + Math.sin(angle) * length,
      );
      tail.addColorStop(0, "#8fbedc88");
      tail.addColorStop(1, "#8fbedc00");
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.sin(angle) * 2, p.y + Math.cos(angle) * 2);
      ctx.lineTo(
        p.x + Math.cos(angle + 0.055) * length,
        p.y + Math.sin(angle + 0.055) * length,
      );
      ctx.lineTo(
        p.x + Math.cos(angle - 0.055) * length,
        p.y + Math.sin(angle - 0.055) * length,
      );
      ctx.closePath();
      ctx.fill();
    }
    const rings = b.id === "saturn" || b.name === "Ringed Ice Giant";
    if (rings) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-0.36);
      ctx.strokeStyle = "#d7caa366";
      ctx.lineWidth = r * 0.28;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.45, r * 0.74, 0, 0, 7);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.strokeStyle = "#9c967d88";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r * 0.82, 0, 0, 7);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 7);
    ctx.clip();
    if (b.type === "star") {
      const g = ctx.createRadialGradient(
        p.x - r * 0.35,
        p.y - r * 0.4,
        0,
        p.x,
        p.y,
        r * 1.2,
      );
      g.addColorStop(0, "#fffbe5");
      g.addColorStop(0.55, "#ffe5a9");
      g.addColorStop(1, b.color);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    } else if (b.type === "blackhole") {
      ctx.fillStyle = "#030308";
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    } else {
      ctx.drawImage(texture(b), p.x - r, p.y - r, r * 2, r * 2);
      if (pack !== "theme") {
        ctx.fillStyle = pack === "blue" ? "#4378e04d" : "#f6aa574d";
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      const g = ctx.createRadialGradient(
        p.x - r * 0.4,
        p.y - r * 0.45,
        r * 0.1,
        p.x + r * 0.15,
        p.y + r * 0.12,
        r * 1.1,
      );
      g.addColorStop(0, "#fffad525");
      g.addColorStop(0.5, "#00000000");
      g.addColorStop(1, "#00000ac9");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = b.color + "88";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 7);
    ctx.stroke();
    if (rings) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-0.36);
      ctx.strokeStyle = "#c9bd9766";
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.45, r * 0.74, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    if (b.id === selected || b.id === hover) {
      ctx.strokeStyle = b.id === selected ? "#8bcbff" : "#a5bdd8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, 7);
      ctx.stroke();
    }
    if (
      view.labels &&
      (b.type !== "moon" || view["moon-names"]) &&
      (!["asteroid", "comet"].includes(b.type) ||
        b.id === selected ||
        b.id === "ceres")
    ) {
      ctx.font =
        (b.id === selected ? "12" : "11") + 'px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = theme === "day" ? "#365578" : "#bfcee5";
      ctx.shadowColor = theme === "day" ? "#fff" : "#080d17";
      ctx.shadowBlur = 4;
      ctx.fillText(
        b.name,
        p.x,
        p.y + (b.id === "sun" || b.id === "jupiter" ? -r - 8 : r + 14),
      );
      ctx.shadowBlur = 0;
    }
    hits.push({
      id: b.id,
      x: p.x,
      y: p.y,
      radius: Math.max(r + 5, 9),
      distance: p.z,
    });
  }
  function drawOrbit(b) {
    if (!b.a || b.live || b.type === "moon") return;
    const parent = state.bodies.find((s) => s.id === b.parent);
    const parentPos = parent?.pos || { x: 0, y: 0, z: 0 };
    ctx.beginPath();
    const key = JSON.stringify([
      b.id,
      b.a,
      b.e,
      b.inclination,
      b.node,
      b.phase,
      b.period,
      parent?.mass,
    ]);
    let points = orbitPaths.get(key);
    if (!points) {
      const period =
        b.period || 365.25 * Math.sqrt(b.a ** 3 / (parent?.mass || 1));
      points = Array.from({ length: 181 }, (_, i) =>
        M.relativePosition(b, (period * i) / 180, parent?.mass || 1),
      );
      orbitPaths.set(key, points);
    }
    points.forEach((v, i) => {
      const p = screen({
        x: v.x + parentPos.x,
        y: v.y + parentPos.y,
        z: v.z + parentPos.z,
      });
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    const active = b.id === selected || b.id === hover;
    ctx.strokeStyle =
      theme === "day"
        ? active
          ? "#2f72b9aa"
          : "#436d9835"
        : active
          ? "#86c5ffb0"
          : b.type === "comet"
            ? "#49608440"
            : "#41629152";
    ctx.globalAlpha = view.fade ? 0.3 : 1;
    ctx.lineWidth = active ? 1.1 : 0.65;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function draw(timestamp) {
    const light = theme === "day";
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(
      0,
      light ? "#dce8f6" : theme === "contrast" ? "#000000" : "#050910",
    );
    bg.addColorStop(
      1,
      light
        ? "#cfddf0"
        : theme === "contrast"
          ? "#000000"
          : theme === "aurora"
            ? "#081522"
            : "#0b1223",
    );
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    stars.forEach((star, i) => {
      ctx.globalAlpha = star.a * (light ? 0.4 : 1);
      ctx.fillStyle = light ? "#3e6088" : star.warm ? "#dfcba0" : "#b8d1ee";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, 7);
      ctx.fill();
      if (i % 83 === 1) {
        ctx.globalAlpha = 0.22;
        ctx.fillRect(star.x - 5, star.y - 0.4, 10, 0.8);
        ctx.fillRect(star.x - 0.4, star.y - 5, 0.8, 10);
      }
    });
    ctx.globalAlpha = 1;
    if (view.axes) {
      [
        [{ x: -100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, "#b2676755"],
        [{ x: 0, y: -100, z: 0 }, { x: 0, y: 100, z: 0 }, "#67ad8b55"],
      ].forEach(([a, b, color]) => {
        const p = screen(a),
          q = screen(b);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      });
    }
    if (view.orbits) state.bodies.forEach(drawOrbit);
    if (view.trails)
      state.bodies.forEach((b) => {
        if (b.type === "moon") return;
        const history = trails.get(b.id);
        if (!history || history.length < 2) return;
        ctx.beginPath();
        history.forEach((p, i) => {
          const q = screen(p);
          if (!i) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.strokeStyle = b.color + "45";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    hits = [];
    state.bodies
      .filter(
        (b) =>
          (view.moons || b.type !== "moon") &&
          (view["show-sun"] || b.type !== "star"),
      )
      .map((b) => ({ b, p: bodyScreen(b) }))
      .sort((a, b) => a.p.z - b.p.z)
      .forEach(({ b, p }) => drawBody(b, p));
  }
  function frame(timestamp) {
    const interval = last ? (timestamp - last) / 1000 : 0.0167;
    const dt = Math.min(0.05, interval);
    last = timestamp;
    if (
      playing &&
      !document.hidden &&
      !document.querySelector("dialog[open]")
    ) {
      M.evolve(state, dt * rate);
      trailTime += dt;
      if (trailTime > 0.05) {
        trailTime = 0;
        state.bodies.forEach((b) => {
          if (b.type === "moon") return;
          if (!trails.has(b.id)) trails.set(b.id, []);
          const history = trails.get(b.id);
          history.push({ ...b.pos });
          if (history.length > 240) history.shift();
        });
      }
    }
    if (timestamp - uiTime > 24) {
      draw(timestamp);
    }
    if (timestamp - uiTime > 220) {
      updateUI();
      $("performance").textContent =
        Math.min(999, Math.round(1 / (interval || 0.0167))) + " fps";
      uiTime = timestamp;
    }
    requestAnimationFrame(frame);
  }
  // Direct controls and persisted state.
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.addEventListener("click", () => switchTab(b.dataset.tab)),
    );
  $("play").addEventListener("click", () => setPlaying(!playing));
  $("speed").addEventListener("input", () => {
    rate = Math.min(365, 10 ** Number($("speed").value));
    $("speed-value").textContent = rate.toFixed(2) + " day/s";
    updateCreation();
  });
  M.SCENARIOS.forEach(([id, name]) => $("scenario").add(new Option(name, id)));
  $("scenario").addEventListener("change", (e) => {
    const id = e.target.value;
    e.target.value = state.scenario;
    requestScenario(id);
  });
  $("body-select").addEventListener("change", (e) => select(e.target.value));
  $("focus").addEventListener("click", () => {
    if (!selectedBody()) return;
    setTracking(selected);
    setZoom(
      selectedBody().type === "star"
        ? 12
        : selectedBody().type === "moon"
          ? 1400
          : 85,
    );
    if (window.innerWidth <= 650) $("sidebar").classList.remove("open");
    notify("Focused: " + selectedBody().name);
  });
  $("follow").addEventListener("click", () => {
    setTracking(tracking === selected ? "" : selected);
  });
  $("untrack").addEventListener("click", () => setTracking(""));
  $("auto-track").addEventListener("change", (e) => {
    setTracking(e.target.value);
    notify(
      tracking ? "Auto track: " + selectedBodyName(tracking) : "Free camera",
    );
  });
  function selectedBodyName(id) {
    return state.bodies.find((b) => b.id === id)?.name || "";
  }
  $("release").addEventListener("click", () => {
    const b = selectedBody();
    if (b) {
      M.release(state, b);
      updateInspector();
      notify(b.name + " released to gravity");
    }
  });
  $("gravity").addEventListener("click", () => {
    state.gravity = !state.gravity;
    if (state.gravity)
      state.bodies
        .filter((b) => b.type !== "moon")
        .forEach((b) => M.release(state, b));
    else {
      // Restore reference rails, while custom bodies continue under gravity.
      state.bodies
        .filter((b) => !b.custom)
        .forEach((b) => {
          b.live = false;
        });
      M.updateRails(state);
      trails.clear();
    }
    notify(
      state.gravity
        ? "Primary bodies live · moons remain on parent-relative rails"
        : "Reference rails restored · custom bodies remain live",
    );
    updateUI();
  });
  function removeSelected() {
    const b = selectedBody();
    if (!b) return;
    const removed = new Set([b.id]);
    for (let i = 0; i < 4; i++)
      state.bodies.forEach((p) => {
        if (removed.has(p.parent)) removed.add(p.id);
      });
    state.bodies = state.bodies.filter((p) => !removed.has(p.id));
    removed.forEach((id) => trails.delete(id));
    if (removed.has(tracking)) tracking = "";
    selected = state.bodies[0]?.id || "";
    rebuildSelectors();
    updateInspector();
    updateUI();
    notify(b.name + " and its satellites removed");
  }
  $("remove").addEventListener("click", () =>
    confirm("Remove this body and its satellites?", removeSelected),
  );
  $("empty").addEventListener("click", () =>
    confirm("Empty the sky?", () => loadScenario("empty")),
  );
  $("clear-trails").addEventListener("click", () => {
    trails.clear();
    notify("Motion trails cleared");
  });
  $("spawn-asteroid").addEventListener("click", () => {
    add({
      type: "asteroid",
      mass: 0.00001,
      radius: 90,
      a: 2.4 + Math.random(),
      phase: Math.random() * Math.PI * 2,
    });
  });
  $("spawn-comet").addEventListener("click", () => {
    add({
      type: "comet",
      mass: 1e-8,
      radius: 12,
      a: 4.8,
      phase: Math.random() * Math.PI * 2,
    });
  });
  Object.entries(M.TYPES).forEach(([type, t]) => {
    const button = document.createElement("button");
    button.textContent =
      (type === "star" ? "✦ " : type === "blackhole" ? "◉ " : "◌ ") + t.label;
    button.dataset.type = type;
    button.addEventListener("click", () => setType(type));
    $("body-types").append(button);
  });
  ["mass", "radius", "orbit-radius"].forEach((id) =>
    $(id).addEventListener("input", updateCreation),
  );
  $("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    add({
      type: createType,
      name: $("new-name").value.trim(),
      mass: 10 ** Number($("mass").value),
      radius: 10 ** Number($("radius").value),
      a: 10 ** Number($("orbit-radius").value),
      phase: 0.65,
    });
  });
  $("save-part").addEventListener("click", () => {
    const b = selectedBody();
    if (!b) return;
    if (parts.length >= 30) {
      notify("Library is full (30 parts). Reset it to restore built-in parts.");
      return;
    }
    const candidate = {
      name: b.name,
      type: b.type === "moon" ? "terrestrial" : b.type,
      mass: b.mass / M.EARTH,
      radius: b.radius,
      a: Math.max(0.05, Math.min(200, b.a || 1)),
    };
    // Ensure tiny catalog moons also fit the supported creation limits.
    candidate.mass = Math.max(1e-10, candidate.mass);
    candidate.radius = Math.max(1, candidate.radius);
    parts.push(candidate);
    if (saveParts()) notify(b.name + " saved to the local library");
    else parts.pop();
  });
  $("rescan").addEventListener("click", () => {
    loadParts();
    renderLibrary();
    notify("Local library reloaded");
  });
  $("reset-library").addEventListener("click", () =>
    confirm("Reset the local parts library?", () => {
      parts = builtinParts.map((p) => ({ ...p }));
      saveParts();
      renderLibrary();
    }),
  );
  $("binary-preset").addEventListener("click", () => requestScenario("binary"));
  function setting(id, value) {
    view[id] = value;
    $(id).checked = value;
    const button = $("toggle-" + id);
    if (button) {
      button.classList.toggle("on", value);
      button.setAttribute("aria-pressed", String(value));
    }
  }
  Object.keys(view).forEach((id) =>
    $(id).addEventListener("change", (e) => setting(id, e.target.checked)),
  );
  ["orbits", "labels", "trails", "moons"].forEach((id) =>
    $("toggle-" + id).addEventListener("click", () => setting(id, !view[id])),
  );
  $("settings-btn").addEventListener("click", () => {
    $("settings").hidden = !$("settings").hidden;
  });
  $("close-settings").addEventListener("click", () => {
    $("settings").hidden = true;
  });
  $("measure-btn").addEventListener("click", () => {
    $("settings").hidden = false;
    $("measure-a").focus();
  });
  $("epoch").addEventListener("click", () => {
    $("settings").hidden = false;
    $("start-date").focus();
  });
  function setDate(ms) {
    if (
      !Number.isFinite(ms) ||
      ms < Date.UTC(1000, 0, 1) ||
      ms > Date.UTC(9999, 11, 31)
    ) {
      notify("Choose a date between years 1000 and 9999");
      return;
    }
    state.days = (ms - M.EPOCH) / 86400000;
    state.bodies.forEach((b) => {
      b.live = false;
    });
    state.gravity = false;
    M.updateRails(state);
    state.bodies.filter((b) => b.custom).forEach((b) => M.release(state, b));
    trails.clear();
    $("start-date").value = new Date(ms).toISOString().slice(0, 10);
    updateUI();
    notify("Epoch updated · reference orbits restored");
  }
  $("set-date").addEventListener("click", () =>
    setDate(Date.parse($("start-date").value + "T00:00:00Z")),
  );
  $("now").addEventListener("click", () => setDate(Date.now()));
  $("date-now").addEventListener("click", () => setDate(Date.now()));
  $("zoom-in").addEventListener("click", () => setZoom(zoom * 1.4));
  $("zoom-out").addEventListener("click", () => setZoom(zoom / 1.4));
  $("reset-view").addEventListener("click", resetCamera);
  $("save").addEventListener("click", () => {
    try {
      localStorage.setItem(
        "aero-save-v2",
        JSON.stringify({ state, theme, pack, view, selected, rate }),
      );
      notify("Aero experiment saved on this device");
    } catch (_) {
      notify("Could not save: device storage unavailable or full");
    }
  });
  $("load").addEventListener("click", () => {
    try {
      const text = localStorage.getItem("aero-save-v2");
      if (!text) {
        notify("No Aero save yet. Use Save to keep this experiment.");
        return;
      }
      const data = JSON.parse(text),
        loaded = M.validateSave(data.state);
      state = loaded;
      selected = state.bodies.some((b) => b.id === data.selected)
        ? data.selected
        : state.bodies[0]?.id || "";
      if (themes.some((t) => t[0] === data.theme)) setTheme(data.theme, false);
      if (["theme", "blue", "dust"].includes(data.pack)) pack = data.pack;
      Object.keys(view).forEach((id) => {
        if (typeof data.view?.[id] === "boolean") setting(id, data.view[id]);
      });
      if (Number.isFinite(data.rate) && data.rate >= 0.01 && data.rate <= 365) {
        rate = data.rate;
        $("speed").value = Math.log10(rate);
        $("speed-value").textContent = rate.toFixed(2) + " day/s";
      }
      trails.clear();
      resetCamera();
      rebuildSelectors();
      renderScenarios();
      $("scenario").value = state.scenario;
      updateUI();
      updateCreation();
      notify("Saved Aero experiment loaded");
    } catch (_) {
      notify("Could not load this save. Current experiment unchanged.");
    }
  });
  themes.forEach(([id, name, desc, bg, accent]) => {
    const button = document.createElement("button");
    button.className = "theme-option";
    button.dataset.themeChoice = id;
    const preview = document.createElement("span");
    preview.className = "theme-preview";
    preview.style.setProperty("--preview-bg", bg);
    preview.style.setProperty("--preview-accent", accent);
    const text = document.createElement("span"),
      strong = document.createElement("strong"),
      small = document.createElement("small"),
      check = document.createElement("span");
    strong.textContent = name;
    small.textContent = desc;
    check.className = "theme-check";
    text.append(strong, small);
    button.append(preview, text, check);
    button.addEventListener("click", () => {
      setTheme(id);
      $("themes").hidden = true;
    });
    $("theme-list").append(button);
  });
  $("themes-btn").addEventListener("click", () => {
    $("themes").hidden = !$("themes").hidden;
  });
  $("help-btn").addEventListener("click", () => $("help-dialog").showModal());
  $("close-help").addEventListener("click", () => $("help-dialog").close());
  $("sidebar-btn").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });
  $("confirm-cancel").addEventListener("click", () => {
    $("confirm-dialog").close();
    $("scenario").value = state.scenario;
  });
  $("confirm-ok").addEventListener("click", () => {
    $("confirm-dialog").close();
    const action = confirmAction;
    confirmAction = null;
    if (action) action();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!$("themes").contains(e.target) && !$("themes-btn").contains(e.target))
      $("themes").hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === "Escape") {
      $("settings").hidden = true;
      $("themes").hidden = true;
      $("sidebar").classList.remove("open");
      return;
    }
    if (document.querySelector("dialog[open]")) return;
    if (e.code === "Space" && !["BUTTON", "A"].includes(e.target.tagName)) {
      e.preventDefault();
      setPlaying(!playing);
    }
    if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey)
      $("settings").hidden = !$("settings").hidden;
    if (e.key === "F1") {
      e.preventDefault();
      $("help-dialog").showModal();
    }
    if (e.key === "F3") {
      e.preventDefault();
      setTheme(
        themes[
          (themes.findIndex((t) => t[0] === theme) + 1) % themes.length
        ][0],
      );
    }
    if (e.key === "+" || e.key === "=") setZoom(zoom * 1.2);
    if (e.key === "-") setZoom(zoom / 1.2);
  });
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  canvas.addEventListener("pointerdown", (e) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    drag = {
      ...p,
      startX: p.x,
      startY: p.y,
      button: e.button,
      moved: false,
      multi: pointers.size > 1,
    };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        length: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    }
    $("hover-tip").hidden = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      const hit = hitAt(p);
      hover = hit?.id || "";
      if (hit) {
        const b = state.bodies.find((body) => body.id === hit.id);
        $("hover-tip").textContent =
          b.name + "\n" + distance(b.pos).toFixed(3) + " AU";
        $("hover-tip").hidden = false;
        $("hover-tip").style.left =
          Math.max(0, Math.min(width - 110, p.x - 35)) + "px";
        $("hover-tip").style.top = Math.min(height - 70, p.y + 16) + "px";
      } else $("hover-tip").hidden = true;
      return;
    }
    const old = pointers.get(e.pointerId);
    pointers.set(e.pointerId, p);
    if (drag && Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4)
      drag.moved = true;
    if (pointers.size === 2 && pinch) {
      if (drag) drag.multi = true;
      const [a, b] = [...pointers.values()],
        length = Math.hypot(a.x - b.x, a.y - b.y),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      if (pinch.length) setZoom((zoom * length) / pinch.length);
      pan.x += x - pinch.x;
      pan.y += y - pinch.y;
      pinch = { length, x, y };
    } else if (drag) {
      if (drag.button === 2) {
        yaw += (p.x - old.x) * 0.005;
        pitch = Math.max(-1.4, Math.min(1.4, pitch + (p.y - old.y) * 0.005));
      } else {
        pan.x += p.x - old.x;
        pan.y += p.y - old.y;
      }
    }
  });
  function hitAt(p) {
    return hits
      .filter((h) => Math.hypot(p.x - h.x, p.y - h.y) <= h.radius)
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.x, p.y - a.y) / a.radius -
          Math.hypot(p.x - b.x, p.y - b.y) / b.radius,
      )[0];
  }
  canvas.addEventListener("pointerup", (e) => {
    if (drag && !drag.moved && !drag.multi && drag.button === 0) {
      const hit = hitAt(local(e));
      if (hit) select(hit.id);
      else if (window.innerWidth <= 650) $("sidebar").classList.remove("open");
    }
    pointers.delete(e.pointerId);
    drag = null;
    pinch = null;
  });
  canvas.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    drag = null;
    pinch = null;
  });
  canvas.addEventListener("pointerleave", () => {
    if (!drag) {
      hover = "";
      $("hover-tip").hidden = true;
    }
  });
  document.addEventListener("visibilitychange", () => {
    last = 0;
  });
  renderScenarios();
  rebuildSelectors();
  setType("terrestrial");
  renderLibrary();
  let storedTheme;
  try {
    storedTheme = localStorage.getItem("aero-theme");
  } catch (_) {
    /* Optional. */
  }
  setTheme(
    themes.some((t) => t[0] === storedTheme) ? storedTheme : "night",
    false,
  );
  resize();
  updateInspector();
  updateUI();
  requestAnimationFrame(frame);
})();
