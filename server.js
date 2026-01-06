// Simple WebSocket lobby for syncing voting sessions
// run: node server.js
// requires: npm install ws

const { WebSocketServer } = require('ws');
const port = process.env.PORT || 3001;

const wss = new WebSocketServer({ port });

const sessions = new Map(); // sessionId -> { clients: Set<ws>, state: Map<name, {ready, progress, selections, online}>, resultsTriggered: boolean }

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
  const resultsFlag = !!session.resultsTriggered;
  const msg = JSON.stringify({ type: 'state', participants, results: resultsFlag });
  session.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
  if (resultsFlag) {
    const resMsg = JSON.stringify({ type: 'results' });
    session.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(resMsg);
    });
    console.log(`[state] session=${sessionId} resultsTriggered=true participants=${participants.length} broadcastedResults=${session.clients.size}`);
  }
}

wss.on('connection', (ws) => {
  let sessionId = 'default';
  let name = null;
  const peer = `${ws._socket.remoteAddress || 'unknown'}:${ws._socket.remotePort || ''}`;
  console.log(`[conn-open] peer=${peer}`);

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
        sessions.set(sessionId, { clients: new Set(), state: new Map(), resultsTriggered: false });
      }
      const session = sessions.get(sessionId);
      session.clients.add(ws);
      const prev = session.state.get(name);
      session.state.set(
        name,
        prev
          ? { ...prev, online: true }
          : { ready: false, progress: null, selections: {}, online: true }
      );
      console.log(`[join] session=${sessionId} name=${name} clients=${session.clients.size}`);
      // als resultaten al gestart zijn, duw meteen een results event en state
      if (session.resultsTriggered) {
        const resMsg = JSON.stringify({ type: 'results' });
        ws.send(resMsg);
        console.log(`[results-replay] session=${sessionId} to=${name}`);
      }
      broadcast(sessionId);
    }
    if (msg.type === 'ready') {
      const session = sessions.get(sessionId);
      if (session && session.state.has(name)) {
        const prev = session.state.get(name);
        const nextReady = !!msg.ready;
        session.state.set(name, { ...prev, ready: nextReady, online: true });
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

        session.state.set(name, { ...prev, progress: nextProgress, selections: nextSelections, online: true });
        if (logNeeded) {
          const currentQ = (nextProgress && nextProgress.qIndex) ?? '-';
          const summary = formatPoints(nextSelections);
          console.log(`[progress] session=${sessionId} name=${name} qIndex=${currentQ} -> ${summary}`);
        }
        broadcast(sessionId);
      }
    }
    if (msg.type === 'ping') {
      // lightweight keep-alive; reply with pong to keep connections warm
      const pong = JSON.stringify({ type: 'pong', ts: msg.ts || Date.now() });
      if (ws.readyState === ws.OPEN) ws.send(pong);
    }
    if (msg.type === 'results') {
      const session = sessions.get(sessionId);
      if (session) {
        console.log(`[results-trigger] session=${sessionId} by=${name} broadcast=${session.clients.size}`);
        session.resultsTriggered = true;
        const resMsg = JSON.stringify({ type: 'results' });
        session.clients.forEach((client) => {
          if (client.readyState === client.OPEN) client.send(resMsg);
        });
        broadcast(sessionId);
        // extra replay na kleine delay om late listeners mee te nemen
        setTimeout(() => broadcast(sessionId), 300);
        setTimeout(() => {
          session.clients.forEach((client) => {
            if (client.readyState === client.OPEN) client.send(resMsg);
          });
          broadcast(sessionId);
        }, 600);
      }
    }
  });

  ws.on('close', (code, reason) => {
    const session = sessions.get(sessionId);
    console.log(`[conn-close] peer=${peer} code=${code} reason=${reason?.toString() || ''} session=${sessionId} name=${name || ''}`);
    if (session) {
      session.clients.delete(ws);
      if (name && session.state.has(name)) {
        const prev = session.state.get(name);
        session.state.set(name, { ...prev, online: false, ready: false });
      }
      broadcast(sessionId);
    }
  });
});

console.log(`WebSocket lobby running on ws://localhost:${port}`);
