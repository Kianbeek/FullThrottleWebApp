// Simple WebSocket lobby for syncing voting sessions
// run: node server.js
// requires: npm install ws

const { WebSocketServer } = require('ws');
const port = process.env.PORT || 3001;

const wss = new WebSocketServer({ port });

const sessions = new Map(); // sessionId -> { clients: Set<ws>, state: Map<name, {ready, progress}> }

function broadcast(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const participants = Array.from(session.state.entries()).map(([name, data]) => ({ name, ...data }));
  const msg = JSON.stringify({ type: 'state', participants });
  session.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}

wss.on('connection', (ws) => {
  let sessionId = 'default';
  let name = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }
    if (msg.type === 'join') {
      sessionId = msg.sessionId || 'default';
      name = msg.name || 'onbekend';
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { clients: new Set(), state: new Map() });
      }
      const session = sessions.get(sessionId);
      session.clients.add(ws);
      session.state.set(name, { ready: false, progress: null });
      broadcast(sessionId);
    }
    if (msg.type === 'ready') {
      const session = sessions.get(sessionId);
      if (session && session.state.has(name)) {
        session.state.set(name, { ...session.state.get(name), ready: !!msg.ready });
        broadcast(sessionId);
        const allReady = Array.from(session.state.values()).every((p) => p.ready);
        if (allReady) {
          const startMsg = JSON.stringify({ type: 'start' });
          session.clients.forEach((client) => {
            if (client.readyState === client.OPEN) client.send(startMsg);
          });
        }
      }
    }
    if (msg.type === 'progress') {
      const session = sessions.get(sessionId);
      if (session && session.state.has(name)) {
        session.state.set(name, { ...session.state.get(name), progress: msg.progress });
        broadcast(sessionId);
      }
    }
  });

  ws.on('close', () => {
    const session = sessions.get(sessionId);
    if (session) {
      session.clients.delete(ws);
      if (name) session.state.delete(name);
      broadcast(sessionId);
    }
  });
});

console.log(`WebSocket lobby running on ws://localhost:${port}`);
