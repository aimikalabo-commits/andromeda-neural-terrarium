const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Default physics state ────────────────────────────────────────────────────
let physicsState = {
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

// ─── Broadcast helpers ────────────────────────────────────────────────────────
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET /status — snapshot of current physics state + connected clients
app.get('/status', (req, res) => {
  res.json({
    physics: physicsState,
    clients: wss.clients.size,
    availableEvents: ['pulse', 'chaos', 'harmony', 'spawn', 'kill'],
    availablePhysicsParams: Object.keys(physicsState),
  });
});

// POST /physics — update one or more physics parameters
// Body: { "gravity": 0.5, "particleSpeed": 2.0 }
app.post('/physics', (req, res) => {
  const updates = req.body;
  const allowed = Object.keys(physicsState);
  const applied = {};
  const rejected = {};

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key) && typeof value === 'number') {
      physicsState[key] = value;
      applied[key] = value;
    } else {
      rejected[key] = 'unknown param or non-numeric value';
    }
  }

  broadcast({ type: 'physics_update', physics: physicsState });

  res.json({ success: true, applied, rejected, physics: physicsState });
});

// POST /event/:name — fire a named event into the simulation
// Available events: pulse, chaos, harmony, spawn, kill
// Body (optional): { "x": 0.5, "y": 0.5, "count": 10 }
app.post('/event/:name', (req, res) => {
  const event = req.params.name;
  const validEvents = ['pulse', 'chaos', 'harmony', 'spawn', 'kill'];

  if (!validEvents.includes(event)) {
    return res.status(400).json({
      success: false,
      error: `Unknown event "${event}"`,
      validEvents,
    });
  }

  const params = req.body || {};

  // For spawn/kill, also sync particleCount in server state
  if (event === 'spawn') {
    const count = typeof params.count === 'number' ? params.count : 10;
    physicsState.particleCount += count;
  }
  if (event === 'kill') {
    const count = typeof params.count === 'number' ? params.count : 10;
    physicsState.particleCount = Math.max(5, physicsState.particleCount - count);
  }

  broadcast({ type: 'event', event, params });

  res.json({ success: true, event, params });
});

// ─── WebSocket: send current state to each new client ────────────────────────
wss.on('connection', (ws) => {
  console.log(`[ws] client connected (total: ${wss.clients.size})`);
  ws.send(JSON.stringify({ type: 'init', physics: physicsState }));

  ws.on('close', () => {
    console.log(`[ws] client disconnected (total: ${wss.clients.size})`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n  Neural Terrarium running at http://localhost:${PORT}`);
  console.log(`\n  God API:`);
  console.log(`    GET  /status`);
  console.log(`    POST /physics       body: { param: value, ... }`);
  console.log(`    POST /event/:name   events: pulse | chaos | harmony | spawn | kill`);
  console.log(`\n  Example commands:`);
  console.log(`    curl -s http://localhost:${PORT}/status | json_pp`);
  console.log(`    curl -s -X POST http://localhost:${PORT}/physics -H 'Content-Type: application/json' -d '{"gravity":0.5}'`);
  console.log(`    curl -s -X POST http://localhost:${PORT}/event/chaos`);
  console.log(`    curl -s -X POST http://localhost:${PORT}/event/pulse -H 'Content-Type: application/json' -d '{"x":0.5,"y":0.5}'`);
  console.log('');
});
