// ─── Physics state ────────────────────────────────────────────────────────────
let physics = {
  gravity: 0,
  connectionDistance: 120,
  connectionStrength: 0.3,
  particleSpeed: 1.5,
  friction: 0.98,
  repulsionDistance: 30,
  repulsionStrength: 0.8,
  fireRate: 0.008,
  particleCount: 80,
};

let particles    = [];
let pulseWaves   = [];
let bgStars      = [];
let nebulae      = [];
let planets      = [];
let blackHole    = null;
let galaxyBuffer = null;
let ws           = null;
let wsConnected  = false;
let frameCount_  = 0;
let time         = 0;

// Galaxy layout
let GCX, GCY, GW;

// ─── Zoom / Pan ───────────────────────────────────────────────────────────────
let zoom      = 1.0;
let panX      = 0;
let panY      = 0;
let _dragging = false;
let _dragOX   = 0;
let _dragOY   = 0;

function mouseWheel(event) {
  const factor  = event.delta > 0 ? 0.90 : 1.11;
  const newZoom = constrain(zoom * factor, 0.3, 4.0);
  // Keep the point under the cursor fixed
  panX  = mouseX - (mouseX - panX) * (newZoom / zoom);
  panY  = mouseY - (mouseY - panY) * (newZoom / zoom);
  zoom  = newZoom;
  return false;
}
function mousePressed() {
  // Only drag if not clicking on the HTML control panel
  if (event && event.target && event.target.closest('#control-panel')) return;
  _dragging = true;
  _dragOX   = mouseX - panX;
  _dragOY   = mouseY - panY;
}
function mouseReleased() { _dragging = false; }
function mouseDragged()  {
  if (_dragging) { panX = mouseX - _dragOX; panY = mouseY - _dragOY; }
}

// ─── Background star ──────────────────────────────────────────────────────────
class BgStar {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width); this.y = random(height);
    this.sz = random(0.4, 2.0);
    this.base = random(50, 180);
    this.phase = random(TWO_PI); this.speed = random(0.007, 0.025);
  }
  draw(t) {
    const a = this.base + sin(t * this.speed + this.phase) * 30;
    noStroke(); fill(215, 225, 255, a);
    ellipse(this.x, this.y, this.sz);
  }
}

// ─── Animated nebula blob ─────────────────────────────────────────────────────
class Nebula {
  constructor(x, y, sz, col) {
    this.x = x; this.y = y; this.sz = sz; this.col = col;
    this.phase = random(TWO_PI); this.drift = random(0.0001, 0.0003);
  }
  draw(t) {
    const [r, g, b] = this.col;
    const d = sin(t * this.drift + this.phase) * 5;
    noStroke();
    for (let i = 5; i > 0; i--) {
      fill(r, g, b, 4 * i);
      ellipse(this.x + d, this.y, this.sz * (i / 5), this.sz * 0.52 * (i / 5));
    }
  }
}

// ─── Black Hole ───────────────────────────────────────────────────────────────
class BlackHole {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.size      = GW * 0.022;
    this.diskAngle = 0;
    this.hotSpots  = [
      { angle: 0,    speed: 0.028 },
      { angle: PI,   speed: 0.022 },
      { angle: PI/2, speed: 0.035 },
    ];
    this.flickerPhase = random(TWO_PI);
  }

  update() {
    this.diskAngle += 0.007;
    for (const hs of this.hotSpots) hs.angle += hs.speed;

    // Gravitational pull + event-horizon consumption
    const pullRange = GW * 0.18;
    const sz        = this.size;
    for (const p of particles) {
      const d = dist(p.pos.x, p.pos.y, this.x, this.y);
      if (d < pullRange && d > sz * 0.5) {
        const str  = 0.06 * (1 - d / pullRange);
        const dir  = p5.Vector.sub(createVector(this.x, this.y), p.pos).normalize().mult(str);
        p.applyForce(dir);
      }
      if (d < sz * 0.7) {           // consumed — respawn on a spiral arm
        const sp = _spiralSpawn();
        p.pos.set(sp.x, sp.y);
        p.vel = p5.Vector.random2D().mult(random(0.3, 1.5));
        p.activation = 0;
      }
    }
  }

  draw(t) {
    const x = this.x, y = this.y, sz = this.size;
    const flicker = sin(t * 0.06 + this.flickerPhase);

    // ── Void shadow (dark gravitational well) ─────────────────────────────────
    noStroke();
    for (let i = 12; i > 0; i--) {
      fill(0, 0, 0, 18 * i);
      ellipse(x, y, sz * (1 + i * 0.45), sz * (0.42 + i * 0.18));
    }

    // ── Gravitational lensing ring ────────────────────────────────────────────
    noFill();
    stroke(200, 220, 255, 10);
    strokeWeight(0.6);
    ellipse(x, y, sz * 7,  sz * 2.9);
    stroke(200, 220, 255, 6);
    strokeWeight(0.3);
    ellipse(x, y, sz * 9,  sz * 3.7);

    // ── Accretion disk ────────────────────────────────────────────────────────
    push();
    translate(x, y);
    rotate(this.diskAngle);
    noFill();

    // Outer rings (orange/red hot gas)
    const diskLayers = [
      { rw: 4.2, rh: 0.62, r: 255, g: 90,  b: 20,  a: 18 },
      { rw: 3.6, rh: 0.54, r: 255, g: 120, b: 30,  a: 28 },
      { rw: 3.0, rh: 0.46, r: 255, g: 160, b: 50,  a: 38 },
      { rw: 2.4, rh: 0.38, r: 255, g: 200, b: 80,  a: 55 },
      { rw: 2.0, rh: 0.32, r: 255, g: 230, b: 140, a: 70 },
      { rw: 1.7, rh: 0.26, r: 240, g: 250, b: 220, a: 90 },
      { rw: 1.4, rh: 0.20, r: 200, g: 230, b: 255, a: 110 + flicker * 20 },
    ];
    for (const dl of diskLayers) {
      stroke(dl.r, dl.g, dl.b, dl.a);
      strokeWeight(1.2);
      ellipse(0, 0, sz * dl.rw, sz * dl.rh);
    }

    // Hot spots on inner disk
    for (const hs of this.hotSpots) {
      const hx = cos(hs.angle) * sz * 0.65;
      const hy = sin(hs.angle) * sz * 0.10;
      noStroke();
      fill(255, 240, 200, 160 + flicker * 30);
      ellipse(hx, hy, sz * 0.28);
      fill(255, 255, 255, 120);
      ellipse(hx, hy, sz * 0.10);
    }

    pop();

    // ── Relativistic jets (perpendicular to disk) ─────────────────────────────
    const jetLen = sz * 9;
    noFill();
    for (let i = 4; i > 0; i--) {
      stroke(160, 190, 255, 8 * i);
      strokeWeight(i * 0.9);
      line(x, y - sz * 0.4, x + (flicker * sz * 0.05), y - jetLen * (i / 4));
      line(x, y + sz * 0.4, x - (flicker * sz * 0.05), y + jetLen * (i / 4));
    }

    // ── Event horizon (pure black) ────────────────────────────────────────────
    noStroke();
    fill(0, 0, 0, 255);
    ellipse(x, y, sz, sz * 0.42);

    // ── Photon sphere ─────────────────────────────────────────────────────────
    noFill();
    stroke(255, 200, 100, 55 + flicker * 20);
    strokeWeight(0.7);
    ellipse(x, y, sz * 1.15, sz * 0.48);
  }
}

// ─── Orbital Planet ───────────────────────────────────────────────────────────
class GalaxyPlanet {
  constructor(cfg) {
    this.orbitR = cfg.orbitR;
    this.speed  = cfg.speed;
    this.angle  = cfg.startAngle || random(TWO_PI);
    this.size   = cfg.size;
    this.col    = cfg.col;
    this.name   = cfg.name || '';
    this.hasRing = cfg.hasRing || false;
    this.x = 0; this.y = 0;
  }
  update() {
    this.angle += this.speed;
    this.x = GCX + cos(this.angle) * this.orbitR;
    this.y = GCY + sin(this.angle) * this.orbitR * 0.40;
  }
  draw() {
    const [r, g, b] = this.col;
    const x = this.x, y = this.y, sz = this.size;

    // Orbit path (very faint)
    noFill(); stroke(255, 255, 255, 6); strokeWeight(0.4);
    push(); translate(GCX, GCY); scale(1, 0.40);
    ellipse(0, 0, this.orbitR * 2); pop();

    // Ring
    if (this.hasRing) {
      push(); translate(x, y); scale(1, 0.25);
      noFill(); stroke(r, g, b, 55); strokeWeight(2.5);
      ellipse(0, 0, sz * 2.8);
      stroke(r, g, b, 28); strokeWeight(5);
      ellipse(0, 0, sz * 3.4); pop();
    }

    // Atmosphere
    noStroke();
    fill(r, g, b, 18); ellipse(x, y, sz * 3.2);
    fill(r, g, b, 38); ellipse(x, y, sz * 2.0);

    // Body
    fill(r * 0.35, g * 0.35, b * 0.35, 255); ellipse(x, y, sz);
    fill(r, g, b, 195); ellipse(x, y, sz * 0.72);
    fill(255, 255, 255, 95);
    ellipse(x - sz * 0.2, y - sz * 0.2, sz * 0.22);

    // Label
    if (this.name) {
      noStroke(); fill(r, g, b, 80);
      textSize(8); textAlign(CENTER);
      text(this.name, x, y + sz * 0.6 + 10);
      textAlign(LEFT);
    }
  }
}

// ─── Neural Particle (star-like, no purple) ───────────────────────────────────
class Particle {
  constructor(x, y) {
    const sp = _spiralSpawn();
    this.pos = createVector(x !== undefined ? x : sp.x, y !== undefined ? y : sp.y);
    this.vel = p5.Vector.random2D().mult(random(0.2, physics.particleSpeed));
    this.acc = createVector(0, 0);
    this.activation  = random(0, 0.4);
    this.baseSize    = random(1.8, 4.2);
    this.firingTimer = random(0, 1 / physics.fireRate);
    this.firing      = false;
    this.fireProgress = 0;
    // Star temperature colour
    const temp = random(1);
    if      (temp < 0.25) { this.sr = 255; this.sg = 195; this.sb = 130; }  // cool orange
    else if (temp < 0.55) { this.sr = 255; this.sg = 245; this.sb = 210; }  // yellow-white
    else if (temp < 0.80) { this.sr = 240; this.sg = 248; this.sb = 255; }  // white
    else                  { this.sr = 180; this.sg = 210; this.sb = 255; }  // hot blue
  }

  update() {
    this.firingTimer++;
    const interval = max(10, 1 / physics.fireRate);
    if (this.firingTimer >= interval) {
      this.firing = true; this.fireProgress = 0; this.firingTimer = 0;
    }
    if (this.firing) {
      this.fireProgress += 0.06;
      if (this.fireProgress >= 1) { this.firing = false; this.activation = min(1, this.activation + 0.35); }
    }
    this.activation = max(0, this.activation * 0.994);
    this.acc.add(createVector(0, physics.gravity * 0.04));
    this.vel.add(this.acc);
    this.vel.limit(physics.particleSpeed * 3.5);
    this.vel.mult(physics.friction);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    if (this.pos.x < 0) this.pos.x = width;
    else if (this.pos.x > width)  this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    else if (this.pos.y > height) this.pos.y = 0;
  }

  applyForce(f) { this.acc.add(f); }

  draw() {
    const sz = this.baseSize + this.activation * 2.5;
    const a  = 160 + this.activation * 90;
    const r  = this.sr, g = this.sg, b = this.sb;
    const px = this.pos.x, py = this.pos.y;

    // ── Nova halo glow ────────────────────────────────────────────────────────
    if (this.activation > 0.08) {
      noStroke();
      fill(r, g, b, this.activation * 18); ellipse(px, py, sz * 5);
      fill(r, g, b, this.activation * 35); ellipse(px, py, sz * 2.5);
    }

    // ── 4 long diffraction spikes (cross) ────────────────────────────────────
    if (this.activation > 0.05) {
      const spikeLen = sz * (2.5 + this.activation * 9);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TWO_PI;
        stroke(r, g, b, this.activation * 130);
        strokeWeight(0.6);
        line(px, py, px + cos(ang) * spikeLen, py + sin(ang) * spikeLen);
      }
      // 4 diagonal secondary spikes (shorter)
      const short = spikeLen * 0.45;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TWO_PI + PI / 4;
        stroke(r, g, b, this.activation * 65);
        strokeWeight(0.4);
        line(px, py, px + cos(ang) * short, py + sin(ang) * short);
      }
    }

    // ── Star body ─────────────────────────────────────────────────────────────
    noStroke(); fill(r, g, b, a);
    ellipse(px, py, sz);
    fill(255, 255, 255, a * 0.7);
    ellipse(px, py, sz * 0.35);
  }
}

// Spawn point in the outer halo — away from the galaxy disk
function _spiralSpawn() {
  const angle = random(TWO_PI);
  const r     = random(GW * 0.62, GW * 1.05);
  return {
    x: GCX + cos(angle) * r,
    y: GCY + sin(angle) * r * 0.55,
  };
}

// ─── Pulse Wave (God-sent, white/gold) ────────────────────────────────────────
class PulseWave {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 10; this.alpha = 200; this.speed = 8;
  }
  update() { this.r += this.speed; this.alpha -= 3.5; }
  draw() {
    noFill();
    stroke(230, 210, 255, this.alpha); strokeWeight(1.4);
    ellipse(this.x, this.y, this.r * 2);
    stroke(180, 160, 220, this.alpha * 0.3); strokeWeight(0.5);
    ellipse(this.x, this.y, this.r * 2 + 16);
  }
  isDead() { return this.alpha <= 0; }
}

// ─── Build galaxy into offscreen buffer ───────────────────────────────────────
function buildGalaxyBuffer() {
  if (galaxyBuffer) galaxyBuffer.remove();
  // Build at 2× screen resolution for sharper zoom
  galaxyBuffer = createGraphics(width * 2, height * 2);
  const g  = galaxyBuffer;
  const cx = width, cy = height;       // center in 2× space
  const gw = GW * 2;
  g.colorMode(RGB, 255, 255, 255, 255);
  g.noStroke();

  // ── Outer halo ────────────────────────────────────────────────────────────
  for (let i = 18; i > 0; i--) {
    g.fill(80, 95, 155, 2);
    g.ellipse(cx, cy, gw * 2.3 * (i/18), gw * 0.90 * (i/18));
  }

  // ── Disk ──────────────────────────────────────────────────────────────────
  for (let i = 14; i > 0; i--) {
    const t = i / 14;
    g.fill(110, 125, 185, 3 + t * 7);
    g.ellipse(cx, cy, gw * 1.35 * t, gw * 0.52 * t);
  }

  // ── Spiral arms (1200 stars × 2 arms) ────────────────────────────────────
  for (let arm = 0; arm < 2; arm++) {
    const ao = arm * PI;
    for (let i = 0; i < 1400; i++) {
      const t     = i / 1400;
      const angle = ao + t * TWO_PI * 2.4;
      const r     = 28 + t * gw * 0.47;
      const sx    = random(-gw * 0.028, gw * 0.028);
      const px    = cx + cos(angle) * (r + sx);
      const py    = cy + sin(angle) * (r + sx) * 0.42;
      const coreness = 1 - t;
      const rr = lerp(170, 255, coreness * 0.4 + random(0, 0.3));
      const gg = lerp(180, 250, coreness * 0.35 + random(0, 0.2));
      const bb = lerp(235, 255, random(0, 0.4));
      g.fill(rr, gg, bb, random(28, 105));
      g.ellipse(px, py, random(0.5, 2.5));
    }
  }

  // ── Dust lanes ────────────────────────────────────────────────────────────
  for (let lane = 0; lane < 4; lane++) {
    const lr = gw * (0.10 + lane * 0.077);
    for (let a = -PI * 0.68; a < PI * 0.68; a += 0.03) {
      const px = cx + cos(a) * lr;
      const py = cy + sin(a) * lr * 0.42 + (lane % 2 === 0 ? -5 : 5);
      g.fill(0, 0, 5, 26 - lane * 4);
      g.ellipse(px, py, 9, 6);
    }
  }

  // ── Galactic bar ──────────────────────────────────────────────────────────
  for (let i = 10; i > 0; i--) {
    g.fill(255, 210, 145, 3 + (i/10) * 10);
    g.ellipse(cx, cy, gw * 0.30 * (i/10), gw * 0.065 * (i/10));
  }

  // ── Void at centre (no bright core — black hole lives here) ───────────────
  for (let i = 8; i > 0; i--) {
    g.fill(0, 0, 0, 22 * i);
    g.ellipse(cx, cy, gw * 0.065 * (i/8), gw * 0.027 * (i/8));
  }

  // ── HII nebulae ───────────────────────────────────────────────────────────
  const hii = [
    { t: 0.24, arm: 0, col: [255, 100, 140] },
    { t: 0.24, arm: 1, col: [255, 100, 140] },
    { t: 0.48, arm: 0, col: [130, 185, 255] },
    { t: 0.48, arm: 1, col: [130, 185, 255] },
    { t: 0.70, arm: 0, col: [255, 155, 100] },
    { t: 0.70, arm: 1, col: [255, 155, 100] },
    { t: 0.87, arm: 0, col: [175, 125, 255] },
  ];
  for (const h of hii) {
    const angle = h.arm * PI + h.t * TWO_PI * 2.4;
    const r     = 28 + h.t * gw * 0.47;
    const nx    = cx + cos(angle) * r;
    const ny    = cy + sin(angle) * r * 0.42;
    for (let i = 5; i > 0; i--) {
      g.fill(h.col[0], h.col[1], h.col[2], 5 * i);
      g.ellipse(nx, ny, 44 * (i/5), 28 * (i/5));
    }
  }

  // ── M32 (compact satellite, close) ───────────────────────────────────────
  const m32x = cx + gw * 0.30, m32y = cy + gw * 0.06;
  for (let i = 8; i > 0; i--) { g.fill(255, 220, 165, 9*i); g.ellipse(m32x, m32y, 26*(i/8), 21*(i/8)); }
  g.fill(255, 255, 235, 230); g.ellipse(m32x, m32y, 5, 4);

  // ── M110 (larger, diffuse satellite) ─────────────────────────────────────
  const m110x = cx - gw * 0.38, m110y = cy - gw * 0.14;
  for (let i = 10; i > 0; i--) { g.fill(185, 200, 240, 5*i); g.ellipse(m110x, m110y, 64*(i/10), 37*(i/10)); }
  g.fill(255, 255, 255, 150); g.ellipse(m110x, m110y, 6, 4);
}

// ─── Setup ────────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 255);
  textFont('Courier New');

  _updateLayout();
  buildGalaxyBuffer();

  // Background stars (outside zoom)
  for (let i = 0; i < 380; i++) bgStars.push(new BgStar());

  // Animated nebulae
  nebulae = [
    new Nebula(GCX + GW * 0.21, GCY - GW * 0.05, GW * 0.11, [255, 115, 155]),
    new Nebula(GCX - GW * 0.23, GCY + GW * 0.04, GW * 0.09, [255, 115, 155]),
    new Nebula(GCX + GW * 0.10, GCY + GW * 0.11, GW * 0.08, [130, 185, 255]),
    new Nebula(GCX - GW * 0.11, GCY - GW * 0.09, GW * 0.08, [130, 185, 255]),
    new Nebula(GCX + GW * 0.37, GCY + GW * 0.02, GW * 0.07, [255, 165, 105]),
    new Nebula(GCX - GW * 0.35, GCY - GW * 0.02, GW * 0.07, [255, 165, 105]),
  ];

  // Black hole at galaxy center
  blackHole = new BlackHole(GCX, GCY);

  // Planets orbiting at various galactic radii
  planets = [
    new GalaxyPlanet({ name: 'PYROX',   orbitR: GW * 0.13, speed: 0.0012, startAngle: 0.5,  size: 12, col: [220, 110, 65] }),
    new GalaxyPlanet({ name: 'VELAN',   orbitR: GW * 0.22, speed: 0.0007, startAngle: 2.2,  size: 18, col: [155, 200, 255], hasRing: true }),
    new GalaxyPlanet({ name: 'XHORATH', orbitR: GW * 0.33, speed: 0.0004, startAngle: 3.9,  size: 10, col: [120, 255, 175] }),
    new GalaxyPlanet({ name: 'DUSKARA', orbitR: GW * 0.44, speed: 0.0002, startAngle: 1.1,  size: 15, col: [195, 155, 255], hasRing: true }),
  ];

  // Particles along spiral arms
  for (let i = 0; i < physics.particleCount; i++) particles.push(new Particle());

  connectWebSocket();
}

function _updateLayout() {
  GCX = width  * 0.5;
  GCY = height * 0.5;
  GW  = min(width, height) * 0.72;
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket() {
  try {
    ws = new WebSocket('ws://localhost:3000');
    ws.onopen    = () => { wsConnected = true; pushGodMessage('Connection to God established.'); };
    ws.onmessage = (e) => { try { handleServerMessage(JSON.parse(e.data)); } catch (_) {} };
    ws.onclose   = () => { wsConnected = false; setTimeout(connectWebSocket, 2500); };
    ws.onerror   = () => { wsConnected = false; };
  } catch (_) { wsConnected = false; setTimeout(connectWebSocket, 2500); }
}

function handleServerMessage(msg) {
  if (msg.type === 'init' || msg.type === 'physics_update') {
    physics = Object.assign(physics, msg.physics);
    syncParticleCount();
    if (typeof window._syncPanelToPhysics === 'function') window._syncPanelToPhysics(physics);
    if (msg.type === 'physics_update') pushGodMessage('God altered the laws of physics.');
  }
  if (msg.type === 'event') dispatchEvent_(msg.event, msg.params || {});
}

function syncParticleCount() {
  while (particles.length < physics.particleCount) particles.push(new Particle());
  while (particles.length > physics.particleCount) particles.pop();
}

// ─── Events from God ──────────────────────────────────────────────────────────
function dispatchEvent_(name, params) {
  if (name === 'pulse') {
    const cx = (params.x !== undefined ? params.x : 0.5) * width;
    const cy = (params.y !== undefined ? params.y : 0.5) * height;
    pulseWaves.push(new PulseWave(cx, cy));
    for (const p of particles) {
      const d = dist(p.pos.x, p.pos.y, cx, cy);
      const maxD = max(width, height) * 0.7;
      if (d < maxD) {
        p.applyForce(p5.Vector.sub(p.pos, createVector(cx, cy)).normalize().mult(map(d, 0, maxD, 3.5, 0)));
        p.activation = min(1, p.activation + map(d, 0, maxD, 0.65, 0));
      }
    }
    pushGodMessage('God sent a pulse through the void.');
  }
  if (name === 'chaos') {
    for (const p of particles) { p.vel = p5.Vector.random2D().mult(random(3, 9)); p.activation = random(0.5, 1); }
    pushGodMessage('God unleashed chaos.');
  }
  if (name === 'harmony') {
    for (const p of particles) { p.vel.mult(0.08); p.activation = 0.35; }
    pushGodMessage('God imposed harmony.');
  }
  if (name === 'spawn') {
    const n = typeof params.count === 'number' ? params.count : 10;
    for (let i = 0; i < n; i++) particles.push(new Particle());
    physics.particleCount = particles.length;
    pushGodMessage(`God breathed ${n} new souls into existence.`);
  }
  if (name === 'kill') {
    const n = min(typeof params.count === 'number' ? params.count : 10, max(0, particles.length - 5));
    particles.splice(0, n);
    physics.particleCount = particles.length;
    pushGodMessage(`God extinguished ${n} souls.`);
  }
}

// ─── God messages ─────────────────────────────────────────────────────────────
const godMsgQueue = [];
function pushGodMessage(text) {
  const container = document.getElementById('god-messages');
  const el = document.createElement('div');
  el.className = 'god-msg';
  el.textContent = `⚡ ${text}`;
  container.appendChild(el);
  godMsgQueue.push({ el, born: millis() });
  if (godMsgQueue.length > 6) godMsgQueue.shift().el.remove();
}
function updateGodMessages() {
  const now = millis();
  for (let i = godMsgQueue.length - 1; i >= 0; i--) {
    const item = godMsgQueue[i], age = now - item.born;
    if (age > 4000) item.el.style.opacity = max(0, 1 - (age - 4000) / 1500);
    if (age > 5500) { item.el.remove(); godMsgQueue.splice(i, 1); }
  }
}

// ─── Particle interactions ────────────────────────────────────────────────────
function applyInteractions() {
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      const cd = physics.connectionDistance;
      if (d2 < cd * cd) {
        const d = sqrt(d2), s = physics.connectionStrength * 0.012 * (1 - d / cd);
        a.applyForce(createVector((dx/d)*s, (dy/d)*s));
        b.applyForce(createVector(-(dx/d)*s, -(dy/d)*s));
        if (a.firing) b.activation = min(1, b.activation + 0.10 * (1 - d/cd));
        if (b.firing) a.activation = min(1, a.activation + 0.10 * (1 - d/cd));
      }
      const rd = physics.repulsionDistance;
      if (d2 < rd * rd && d2 > 0) {
        const d = sqrt(d2), s = physics.repulsionStrength * (1 - d/rd);
        a.applyForce(createVector(-(dx/d)*s, -(dy/d)*s));
        b.applyForce(createVector( (dx/d)*s,  (dy/d)*s));
      }
    }
    a.applyForce(p5.Vector.random2D().mult(0.04 * physics.particleSpeed));
  }
}

// ─── Nova connections — radial rays from source, not full lines ────────────────
function drawConnections() {
  const cd = physics.connectionDistance;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    if (a.activation < 0.05) continue;   // only active particles emit rays

    for (let j = i + 1; j < particles.length; j++) {
      const b  = particles[j];
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < cd * cd) {
        const d   = sqrt(d2);
        const t   = 1 - d / cd;
        const act = (a.activation + b.activation) * 0.5;
        if (act < 0.05) continue;

        // Draw a short ray from the more-active particle toward the other
        // It only extends 35% of the way — looks like a spike, not a bridge
        const src  = a.activation >= b.activation ? a : b;
        const reach = 0.35 + act * 0.20;   // 35-55% of distance
        const ex   = src.pos.x + (dx / d) * (a.activation >= b.activation ?  1 : -1) * d * reach;
        const ey   = src.pos.y + (dy / d) * (a.activation >= b.activation ?  1 : -1) * d * reach;

        const rr = lerp(200, 255, act);
        const gg = lerp(220, 255, act);
        const bb = 255;
        stroke(rr, gg, bb, t * act * 160);
        strokeWeight(0.5 + act * 0.6);
        line(src.pos.x, src.pos.y, ex, ey);
      }
    }
  }
}

// ─── Status panel ─────────────────────────────────────────────────────────────
function updateStatusPanel() {
  frameCount_++;
  if (frameCount_ % 30 !== 0) return;
  document.getElementById('status-panel').innerHTML = [
    `particles  ${particles.length}`,
    `gravity    ${physics.gravity.toFixed(2)}`,
    `conn dist  ${physics.connectionDistance}`,
    `fire rate  ${physics.fireRate.toFixed(4)}`,
    `speed      ${physics.particleSpeed.toFixed(2)}`,
    `zoom       ${zoom.toFixed(2)}×`,
    wsConnected ? `god  online` : `god  offline`,
  ].join('<br>');
}

// ─── Main draw loop ───────────────────────────────────────────────────────────
function draw() {
  time++;

  // Deep space background
  noStroke(); fill(0, 0, 8, 35);
  rect(0, 0, width, height);

  // Background stars stay fixed (outside zoom — they're distant galaxies)
  for (const s of bgStars) s.draw(time);

  // ── Everything inside zoom/pan transform ──────────────────────────────────
  push();
  translate(panX, panY);
  scale(zoom);

  // Galaxy (2× buffer drawn at half size = 1× visual)
  if (galaxyBuffer) image(galaxyBuffer, 0, 0, width, height);

  // Animated nebulae
  for (const n of nebulae) n.draw(time);

  // Planets
  for (const pl of planets) { pl.update(); pl.draw(); }

  // Black hole
  blackHole.update();
  blackHole.draw(time);

  // Pulse waves
  for (let i = pulseWaves.length - 1; i >= 0; i--) {
    pulseWaves[i].update(); pulseWaves[i].draw();
    if (pulseWaves[i].isDead()) pulseWaves.splice(i, 1);
  }

  // Neural star connections + particles
  drawConnections();
  applyInteractions();
  for (const p of particles) { p.update(); p.draw(); }

  pop();
  // ─────────────────────────────────────────────────────────────────────────

  updateStatusPanel();
  updateGodMessages();
}

// ─── Resize ───────────────────────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  _updateLayout();
  buildGalaxyBuffer();
  blackHole.x = GCX; blackHole.y = GCY;
  blackHole.size = GW * 0.022;
  const radii = [0.13, 0.22, 0.33, 0.44];
  planets.forEach((pl, i) => { pl.orbitR = GW * radii[i]; });
  const nb = nebulae;
  if (nb[0]) { nb[0].x = GCX + GW*0.21; nb[0].y = GCY - GW*0.05; }
  if (nb[1]) { nb[1].x = GCX - GW*0.23; nb[1].y = GCY + GW*0.04; }
  if (nb[2]) { nb[2].x = GCX + GW*0.10; nb[2].y = GCY + GW*0.11; }
  if (nb[3]) { nb[3].x = GCX - GW*0.11; nb[3].y = GCY - GW*0.09; }
  if (nb[4]) { nb[4].x = GCX + GW*0.37; nb[4].y = GCY + GW*0.02; }
  if (nb[5]) { nb[5].x = GCX - GW*0.35; nb[5].y = GCY - GW*0.02; }
  bgStars.forEach(s => s.reset());
}
