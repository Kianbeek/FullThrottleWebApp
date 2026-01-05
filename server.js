// Simple WebSocket lobby for syncing voting sessions
// run: node server.js
// requires: npm install ws

const { WebSocketServer } = require('ws');
const port = process.env.PORT || 3001;

const wss = new WebSocketServer({ port });

const sessions = new Map(); // sessionId -> { clients: Set<ws>, state: Map<name, {ready, progress, selections}> }

function sameSelections(a = {}, b = {}) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function formatPoints(selections = {}, weights = [3, 2, 1]) {
  const entries = [];
  Object.entries(selections).forEach(([qid, picks]) => {
    if (!Array.isArray(picks)) return;
    picks.forEach((mapId, idx) => {
      const pts = weights[idx] || 0;
      entries.push(`q${qid}: ${mapId} (+${pts})`);
    });
  });
  return entries.length ? entries.join(', ') : 'geen keuzes';
}

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
      session.state.set(name, { ready: false, progress: null, selections: {} });
      console.log(`[join] session=${sessionId} name=${name} clients=${session.clients.size}`);
      broadcast(sessionId);
    }
    if (msg.type === 'ready') {
      const session = sessions.get(sessionId);
      if (session && session.state.has(name)) {
        const prev = session.state.get(name);
        const nextReady = !!msg.ready;
        session.state.set(name, { ...prev, ready: nextReady });
        if (prev.ready !== nextReady) {
          console.log(`[ready] session=${sessionId} name=${name} ready=${nextReady}`);
        }
        broadcast(sessionId);
        const allReady = Array.from(session.state.values()).every((p) => p.ready);
        if (allReady) {
          console.log(`[start] session=${sessionId} all ready`);
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
        const prev = session.state.get(name);
        const nextProgress = msg.progress;
        const nextSelections = msg.selections || {};
        const sameProgress =
          prev.progress &&
          nextProgress &&
          prev.progress.qIndex === nextProgress.qIndex &&
          prev.progress.total === nextProgress.total;
        const logNeeded = !sameProgress || !sameSelections(prev.selections, nextSelections);

        session.state.set(name, { ...prev, progress: nextProgress, selections: nextSelections });
        if (logNeeded) {
          const currentQ = (nextProgress && nextProgress.qIndex) ?? '-';
          console.log(`[progress] session=${sessionId} name=${name} qIndex=${currentQ} -> ${formatPoints({ [currentQ]: nextSelections[currentQ] || [] })}`);
        }
        broadcast(sessionId);
      }
    }
    if (msg.type === 'results') {
      const session = sessions.get(sessionId);
      if (session) {
        console.log(`[results-trigger] session=${sessionId} by=${name}`);
        const resMsg = JSON.stringify({ type: 'results' });
        session.clients.forEach((client) => {
          if (client.readyState === client.OPEN) client.send(resMsg);
        });
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
