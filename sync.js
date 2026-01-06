// Lightweight client-side sync using WebSocket
// Requires server.js running (default ws://localhost:3001 or your public/tunnel endpoint)
(function(){
  console.log('[sync] script loaded');
  // Publieke endpoint (Cloudflare) zodat GitHub Pages kan verbinden via wss.
  const WS_URL = 'wss://ws.fullthrottleclubapp.com';
  let socket = null;
  let sessionId = 'default';
  let userName = null;
  let isReady = false;
  let participantsState = [];
  let resultsLogged = false;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let pendingMessages = [];
  let heartbeatTimer = null;

  function connect(name) {
    console.log('[sync] connect called with name', name);
    userName = name;
    // clear eventuele open socket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'reconnect');
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => {
      console.log('[ws] open');
      reconnectAttempts = 0;
      send({ type: 'join', sessionId, name: userName });
      flushPending();
      startHeartbeat();
    });
    socket.addEventListener('error', (err) => {
      console.warn('[ws] error', err);
    });
    socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch (e) {
        console.warn('Bad message', e);
      }
    });
    socket.addEventListener('close', (ev) => {
      console.warn('[ws] close', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      setStatus('Verbinding verbroken');
      stopHeartbeat();
      // automatische reconnect met backoff
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        console.log('[ws] reconnect attempt', reconnectAttempts);
        connect(userName);
      }, delay);
    });
  }

  function send(payload) {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(payload));
    } else {
      // bufferen tot de socket open is
      pendingMessages.push(payload);
      console.warn('[ws] send queued, socket not open. queue len=', pendingMessages.length, 'payload=', payload.type);
    }
  }

  function flushPending() {
    if (!socket || socket.readyState !== 1) return;
    if (pendingMessages.length) {
      console.log('[ws] flushing queued messages', pendingMessages.map((p) => p.type));
    }
    while (pendingMessages.length) {
      const p = pendingMessages.shift();
      socket.send(JSON.stringify(p));
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 10000); // 10s keepalive
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function setStatus(text) {
    const el = document.getElementById('sessionStatus');
    if (el) el.textContent = text || '';
  }

  function updateReady(flag) {
    isReady = flag;
    send({ type: 'ready', sessionId, name: userName, ready: flag });
  }

  function updateProgress(qIndex, total, selections = {}) {
    send({ type: 'progress', sessionId, name: userName, progress: { qIndex, total }, selections });
  }

  function triggerResults() {
    send({ type: 'results', sessionId, name: userName });
  }

  function handleMessage(msg) {
    if (msg.type === 'state') {
      participantsState = msg.participants || [];
      renderParticipants(participantsState);
      if (window.onSyncParticipantsUpdated) {
        window.onSyncParticipantsUpdated(participantsState);
      }
      if (msg.results && window.onSyncResults) {
        if (!resultsLogged) {
          console.log('[ws] results flag via state');
          resultsLogged = true;
        }
        window.onSyncResults();
      }
    }
    if (msg.type === 'start') {
      window.startQuestions && window.startQuestions();
    }
    if (msg.type === 'results') {
      if (!resultsLogged) {
        console.log('[ws] results message');
        resultsLogged = true;
      }
      window.onSyncResults && window.onSyncResults();
    }
  }

  function renderParticipants(list) {
    const target = document.getElementById('participantsList');
    if (!target) return;
    target.innerHTML = '';
    list.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'participant-row';
      const name = document.createElement('div');
      name.className = 'participant-name';
      name.textContent = p.name;
      const meta = document.createElement('div');
      meta.className = 'participant-progress';
      const ready = p.ready ? 'OK' : '...';
      const prog = p.progress ? `${p.progress.qIndex + 1}/${p.progress.total}` : '-';
      meta.textContent = `${ready} ${prog}`;
      row.append(name, meta);
      target.append(row);
    });
  }

  window.Sync = {
    connect,
    updateReady,
    updateProgress,
    setStatus,
    triggerResults,
    _debug: { getSocket: () => socket },
  };
  console.log('[sync] API ready on window.Sync');
})();
