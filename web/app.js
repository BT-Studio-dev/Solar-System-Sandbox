/* Offline UI and renderer. No network requests or external assets. */
(() => {
  'use strict';
  const P = window.SolarPhysics;
  const $ = id => document.getElementById(id);
  const canvas = $('space'), ctx = canvas.getContext('2d');
  let bodies = P.initialBodies(), years = 0, selected = 'earth';
  let running = true, speed = 0.2, following = false, pending = null;
  let width = 1, height = 1, baseScale = 40, zoom = 1, pan = { x: 0, y: 0 };
  let compressed = true, showOrbits = true, showTrails = true, showLabels = true;
  let trails = new Map(), lastFrame = 0, lastUI = 0, toastTimer;
  let starField = [], pointers = new Map(), gesture = null, pointerDown = null;
  let simulationAccumulator = 0;
  const descriptions = {
    sun: 'The star at the heart of it all.', mercury: 'Small world. Fast journey.',
    venus: 'A brilliant world, wrapped in clouds.', earth: 'Our pale blue dot.',
    mars: 'The next horizon.', jupiter: 'The giant of our neighborhood.',
    saturn: 'A world with a little extra flair.', uranus: 'A quiet, distant ice giant.',
    neptune: 'Blue at the edge of the familiar.'
  };
  const orbitRadii = Object.fromEntries(P.PLANETS.map(p => [p[0].toLowerCase(), p[1]]));
  function sun() { return bodies.find(b => b.id === 'sun'); }
  function chosen() { return bodies.find(b => b.id === selected) || sun(); }
  function radial(x, y) {
    const r = Math.hypot(x, y);
    if (!compressed || r === 0) return { x, y };
    const f = Math.pow(r, 0.54) / r;
    return { x: x * f, y: y * f };
  }
  function anchor() {
    if (!following) return { x: 0, y: 0 };
    const s = sun(), b = chosen();
    return radial(b.x - s.x, b.y - s.y);
  }
  function worldToScreen(x, y) {
    const s = sun(), v = radial(x - s.x, y - s.y), a = anchor();
    return { x: width / 2 + pan.x + (v.x - a.x) * baseScale * zoom,
      y: height / 2 + pan.y - (v.y - a.y) * baseScale * zoom };
  }
  function screenToWorld(x, y) {
    const a = anchor(), s = sun();
    let vx = (x - width / 2 - pan.x) / (baseScale * zoom) + a.x;
    let vy = -(y - height / 2 - pan.y) / (baseScale * zoom) + a.y;
    const r = Math.hypot(vx, vy);
    if (compressed && r > 0) { const f = Math.pow(r, 1 / 0.54) / r; vx *= f; vy *= f; }
    return { x: vx + s.x, y: vy + s.y };
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseScale = Math.min(width, height) * (compressed ? 0.069 : 0.0143);
    let seed = 57;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    starField = Array.from({ length: Math.floor(width * height / 1500) }, () =>
      ({ x: rand() * width, y: rand() * height, r: rand() * 0.8 + 0.25, a: rand() * 0.45 + 0.12 }));
  }
  new ResizeObserver(resize).observe(canvas);
  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  function setZoom(value) {
    zoom = Math.max(0.2, Math.min(20, value));
    $('zoom-label').textContent = Math.round(zoom * 100) + '%';
  }
  function fit() {
    following = false; pan = { x: 0, y: 0 }; setZoom(1); updateFollow();
  }
  function rebuildList() {
    $('body-list').replaceChildren();
    const s = sun();
    bodies.forEach(b => {
      const button = document.createElement('button');
      button.className = 'body-item' + (b.id === selected ? ' active' : '');
      button.setAttribute('aria-pressed', String(b.id === selected));
      button.dataset.id = b.id;
      const dot = document.createElement('span'); dot.className = 'body-dot';
      dot.style.setProperty('--body-color', b.color);
      const text = document.createElement('span'); text.className = 'body-text';
      const name = document.createElement('strong'); name.textContent = b.name;
      const detail = document.createElement('small');
      detail.textContent = b.id === 'sun' ? 'OUR HOME STAR' : Math.hypot(b.x - s.x, b.y - s.y).toFixed(2) + ' AU FROM SUN';
      text.append(name, detail);
      const arrow = document.createElement('span'); arrow.className = 'item-arrow'; arrow.textContent = '↗';
      button.append(dot, text, arrow);
      button.addEventListener('click', () => {
        selectBody(b.id); $('body-panel').classList.remove('open');
        $('bodies-btn').setAttribute('aria-expanded', 'false');
        if (width < 700 && window.innerWidth <= 700) setInspector(true);
      });
      $('body-list').append(button);
    });
    $('body-count').textContent = String(bodies.length).padStart(2, '0');
    $('status-count').textContent = bodies.length + ' bodies';
  }
  function selectBody(id) {
    selected = id; rebuildList(); updateInspector(); updateFollow();
    const b = chosen();
    $('body-name').textContent = b.name;
    $('body-kind').textContent = b.kind.toUpperCase();
    $('body-description').textContent = descriptions[b.id] || 'A new world. Your own possibilities.';
    $('planet-sphere').style.background = 'radial-gradient(circle at 30% 25%, #e1f3ff, ' + b.color + ' 28%, #0b1629 95%)';
    $('planet-sphere').style.boxShadow = '0 0 45px ' + b.color + '22, inset -8px -7px 15px #0008';
    $('remove-btn').disabled = b.id === 'sun';
  }
  function value(id, number, unit) {
    const el = $(id); el.replaceChildren(document.createTextNode(number + ' '));
    const small = document.createElement('small'); small.textContent = unit; el.append(small);
  }
  function updateInspector() {
    const b = chosen(), s = sun(), r = Math.hypot(b.x - s.x, b.y - s.y);
    value('mass-value', b.id === 'sun' ? b.mass.toFixed(2) : (b.mass / P.EARTH_MASS).toFixed(2), b.id === 'sun' ? 'Suns' : 'Earths');
    value('distance-value', r.toFixed(2), 'AU');
    value('velocity-value', (Math.hypot(b.vx - s.vx, b.vy - s.vy) * P.AU_PER_YEAR_TO_KMS).toFixed(2), 'km/s');
    value('period-value', b.id === 'sun' ? '—' : Math.sqrt(r * r * r / s.mass).toFixed(2), b.id === 'sun' ? '' : 'years ≈');
    $('elapsed').textContent = years.toFixed(2);
    document.querySelectorAll('.body-item').forEach(button => {
      const item = bodies.find(body => body.id === button.dataset.id);
      if (item && item.id !== 'sun') button.querySelector('small').textContent = Math.hypot(item.x - s.x, item.y - s.y).toFixed(2) + ' AU FROM SUN';
    });
  }
  function updateFollow() {
    $('follow-btn').textContent = following ? 'Stop following' : 'Follow body';
    $('view-title').textContent = following ? 'FOLLOWING ' + chosen().name.toUpperCase() : 'SOLAR SYSTEM';
  }
  function setRunning(next) {
    running = next;
    $('play-btn').textContent = running ? 'Ⅱ' : '▶';
    $('play-btn').setAttribute('aria-label', running ? 'Pause simulation' : 'Resume simulation');
    $('simulation-state').textContent = running ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED';
    updateInspector();
  }
  function reset() {
    bodies = P.initialBodies(); years = 0; selected = 'earth'; trails.clear(); simulationAccumulator = 0;
    cancelPlacement(); fit(); selectBody(selected); setRunning(true); toast('A fresh start for your solar system.');
  }
  function cancelPlacement() {
    pending = null; $('spawn-hint').hidden = true; $('universe').classList.remove('placing');
  }
  function placePlanet(x, y) {
    if (!pending) return;
    const position = screenToWorld(x, y), s = sun();
    const dx = position.x - s.x, dy = position.y - s.y, r = Math.hypot(dx, dy);
    if (r < 0.15 || r > 500) { toast('Place your planet between 0.15 and 500 AU from the Sun.'); return; }
    const v = pending.motion === 'stationary' ? 0 : Math.sqrt(P.G * s.mass / r) * (pending.motion === 'retrograde' ? -1 : 1);
    const b = { id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: pending.name, mass: pending.mass * P.EARTH_MASS, x: position.x, y: position.y,
      vx: s.vx - dy / r * v, vy: s.vy + dx / r * v,
      color: pending.type === 'giant' ? '#d3a6ec' : '#94d8b3', radius: pending.type === 'giant' ? 10 : 5.5,
      kind: pending.type === 'giant' ? 'Custom gas giant' : 'Custom rocky planet', custom: true };
    bodies.push(b); cancelPlacement(); selectBody(b.id); toast(b.name + ' has joined your universe.');
  }
  function drawOrbit(radius, color, selectedOrbit) {
    const s = sun(), c = worldToScreen(s.x, s.y);
    const rr = (compressed ? Math.pow(radius, 0.54) : radius) * baseScale * zoom;
    if (rr < 1 || rr > 10000) return;
    ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
    ctx.strokeStyle = selectedOrbit ? color + '4d' : '#8296b520'; ctx.lineWidth = selectedOrbit ? 1 : 0.7;
    ctx.setLineDash(selectedOrbit ? [3, 5] : []); ctx.stroke(); ctx.setLineDash([]);
  }
  function draw(timestamp) {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
    bg.addColorStop(0, '#101b2a'); bg.addColorStop(0.5, '#0a111e'); bg.addColorStop(1, '#060b14');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    for (const star of starField) {
      ctx.globalAlpha = star.a; ctx.fillStyle = '#c5d6f1';
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const s = sun();
    if (showOrbits) bodies.forEach(b => {
      if (b.id !== 'sun') drawOrbit(orbitRadii[b.id] || Math.hypot(b.x - s.x, b.y - s.y), b.color, b.id === selected);
    });
    if (showTrails) bodies.forEach(b => {
      const points = trails.get(b.id);
      if (!points || points.length < 2 || b.id === 'sun') return;
      ctx.beginPath();
      points.forEach((p, i) => { const v = worldToScreen(p.x, p.y); if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
      ctx.strokeStyle = b.color + '55'; ctx.lineWidth = 1.25; ctx.stroke();
    });
    // Paint the selected body last, for clear selection even at close conjunctions.
    const ordered = bodies.filter(b => b.id !== selected).concat(chosen());
    ordered.forEach(b => {
      const pos = worldToScreen(b.x, b.y), r = bodyRadius(b);
      if (pos.x < -60 || pos.x > width + 60 || pos.y < -60 || pos.y > height + 60) return;
      if (b.id === 'sun') {
        const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r * 4.2);
        glow.addColorStop(0, '#ffbb6540'); glow.addColorStop(1, '#ffbb6500');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 4.2, 0, Math.PI * 2); ctx.fill();
      }
      if (b.id === selected) {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2); ctx.strokeStyle = b.color + '90'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 10, -0.35, 0.35); ctx.strokeStyle = b.color; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (b.id === 'saturn') {
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(-0.45);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, 0, Math.PI * 2);
        ctx.lineWidth = 2.2; ctx.strokeStyle = '#bda87d88'; ctx.stroke(); ctx.restore();
      }
      const sphere = ctx.createRadialGradient(pos.x - r * 0.35, pos.y - r * 0.4, 0, pos.x, pos.y, r * 1.2);
      sphere.addColorStop(0, b.id === 'sun' ? '#fff4c2' : '#e9f6ff');
      sphere.addColorStop(0.3, b.color); sphere.addColorStop(1, b.id === 'sun' ? '#eaa04f' : '#172237');
      ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
      if (showLabels) {
        ctx.font = (b.id === selected ? '500 ' : '') + '9px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = b.id === selected ? '#d7e6fd' : '#7e90ab';
        ctx.textAlign = 'left'; ctx.fillText(b.name, pos.x + r + 9, pos.y + 3);
      }
    });
  }
  function bodyRadius(b) { return b.radius * Math.max(0.65, Math.min(1.45, Math.pow(zoom, 0.2))) * Math.min(1, Math.max(0.65, width / 450)); }
  function frame(timestamp) {
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    if (running && !document.querySelector('dialog[open]') && !document.hidden) {
      const dt = delta * speed;
      P.advance(bodies, dt); years += dt; simulationAccumulator += delta;
      if (simulationAccumulator >= 0.035) {
        simulationAccumulator = 0;
        bodies.forEach(b => {
          if (!trails.has(b.id)) trails.set(b.id, []);
          const history = trails.get(b.id); history.push({ x: b.x, y: b.y });
          if (history.length > 360) history.shift();
        });
      }
    }
    if (timestamp - lastUI > 200) { updateInspector(); lastUI = timestamp; }
    draw(timestamp); requestAnimationFrame(frame);
  }
  function localPoint(event) {
    const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); setZoom(zoom * Math.exp(-event.deltaY * 0.0015));
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, localPoint(event));
    pointerDown = { ...localPoint(event), button: event.button, moved: false, multi: pointers.size > 1 };
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      gesture = { distance: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const old = pointers.get(event.pointerId), point = localPoint(event); pointers.set(event.pointerId, point);
    if (pointerDown && Math.hypot(point.x - pointerDown.x, point.y - pointerDown.y) > 5) pointerDown.moved = true;
    if (pointers.size === 2 && gesture) {
      if (pointerDown) pointerDown.multi = true;
      const [a, b] = Array.from(pointers.values()), distance = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (gesture.distance > 0) setZoom(zoom * distance / gesture.distance);
      pan.x += cx - gesture.cx; pan.y += cy - gesture.cy;
      gesture = { distance, cx, cy };
    } else if (pointerDown && (event.buttons === 2 || event.buttons === 4)) {
      pan.x += point.x - old.x; pan.y += point.y - old.y;
    }
  });
  canvas.addEventListener('pointerup', event => {
    const p = localPoint(event);
    if (pointerDown && !pointerDown.moved && !pointerDown.multi && pointerDown.button === 0) {
      if (pending) placePlanet(p.x, p.y);
      else {
        let hit = null, nearest = Infinity;
        bodies.forEach(b => {
          const v = worldToScreen(b.x, b.y), d = Math.hypot(v.x - p.x, v.y - p.y);
          if (d < Math.max(bodyRadius(b) + 7, 14) && d < nearest) { hit = b; nearest = d; }
        });
        if (hit) { selectBody(hit.id); if (window.innerWidth <= 700) setInspector(true); }
      }
    }
    pointers.delete(event.pointerId); gesture = null; pointerDown = null;
  });
  canvas.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); pointerDown = null; gesture = null; });
  $('play-btn').addEventListener('click', () => setRunning(!running));
  document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
    speed = Number(button.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', b === button));
  }));
  $('zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
  $('zoom-out').addEventListener('click', () => setZoom(zoom / 1.25));
  $('fit-btn').addEventListener('click', fit);
  $('follow-btn').addEventListener('click', () => { following = !following; pan = { x: 0, y: 0 }; updateFollow(); });
  $('orbits-toggle').addEventListener('change', event => { showOrbits = event.target.checked; });
  $('trails-toggle').addEventListener('change', event => { showTrails = event.target.checked; });
  $('labels-toggle').addEventListener('change', event => { showLabels = event.target.checked; });
  $('scale-toggle').addEventListener('change', event => { compressed = event.target.checked; resize(); fit(); });
  $('bodies-btn').addEventListener('click', () => {
    const open = $('body-panel').classList.toggle('open'); $('bodies-btn').setAttribute('aria-expanded', String(open));
  });
  function setInspector(open) {
    $('inspector').classList.toggle('open', open);
    $('info-btn').setAttribute('aria-expanded', String(open));
  }
  $('info-btn').addEventListener('click', () => setInspector(!$('inspector').classList.contains('open')));
  $('close-inspector').addEventListener('click', () => setInspector(false));
  $('remove-btn').addEventListener('click', () => {
    if (selected === 'sun') return;
    const name = chosen().name; bodies = bodies.filter(b => b.id !== selected); trails.delete(selected);
    selected = 'sun'; selectBody(selected); toast(name + ' removed.');
  });
  $('new-type').addEventListener('change', event => { $('new-mass').value = event.target.value === 'giant' ? '100' : '1'; });
  $('add-btn').addEventListener('click', () => {
    if (bodies.length >= P.MAX_BODIES) { toast('This sandbox supports up to ' + P.MAX_BODIES + ' bodies.'); return; }
    cancelPlacement(); setInspector(false); $('add-dialog').showModal();
  });
  $('close-add').addEventListener('click', () => $('add-dialog').close());
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const mass = Number($('new-mass').value);
    if (!Number.isFinite(mass) || mass < 0.01 || mass > 1000) return;
    pending = { name: $('new-name').value.trim() || 'World ' + (bodies.filter(b => b.custom).length + 1),
      type: $('new-type').value, mass, motion: $('new-motion').value };
    $('add-dialog').close(); $('spawn-hint').hidden = false; $('universe').classList.add('placing');
    $('body-panel').classList.remove('open');
  });
  $('cancel-spawn').addEventListener('click', cancelPlacement);
  $('help-btn').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  $('reset-btn').addEventListener('click', () => $('confirm-dialog').showModal());
  $('cancel-reset').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-reset').addEventListener('click', () => { $('confirm-dialog').close(); reset(); });
  $('save-btn').addEventListener('click', () => {
    try {
      localStorage.setItem('solar-sandbox-v1', JSON.stringify({ version: 1, bodies, years }));
      toast('Sandbox saved on this device.');
    } catch (_) { toast('Could not save: device storage is unavailable or full.'); }
  });
  $('load-btn').addEventListener('click', () => {
    try {
      const text = localStorage.getItem('solar-sandbox-v1');
      if (!text) { toast('No saved sandbox yet. Use Save to keep an experiment.'); return; }
      const data = P.validateSave(JSON.parse(text));
      bodies = data.bodies; years = data.years; trails.clear(); selected = bodies.some(b => b.id === 'earth') ? 'earth' : 'sun';
      cancelPlacement(); fit(); selectBody(selected); toast('Your saved universe is back.');
    } catch (_) { toast('Could not load this save. Your current sandbox is unchanged.'); }
  });
  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'Escape') { cancelPlacement(); $('body-panel').classList.remove('open'); setInspector(false); }
    if (document.querySelector('dialog[open]')) return;
    if (event.code === 'Space' && !['BUTTON', 'A'].includes(event.target.tagName)) { event.preventDefault(); setRunning(!running); }
    if (event.key === '+' || event.key === '=') setZoom(zoom * 1.2);
    if (event.key === '-') setZoom(zoom / 1.2);
    if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) $('confirm-dialog').showModal();
  });
  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  if ('ontouchstart' in window) $('view-hint').textContent = 'Pinch to zoom · Two fingers to pan';
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); fit(); });
  selectBody(selected); resize(); requestAnimationFrame(frame);
})();
