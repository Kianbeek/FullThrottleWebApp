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

  function connect(name) {
    console.log('[sync] connect called with name', name);
    userName = name;
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => {
      console.log('[ws] open');
      send({ type: 'join', sessionId, name: userName });
    });
    socket.addEventListener('error', (err) => {
      console.warn('[ws] error', err);
    });
    socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        console.log('[ws] message', msg);
        handleMessage(msg);
      } catch (e) {
        console.warn('Bad message', e);
      }
    });
    socket.addEventListener('close', () => {
      console.warn('[ws] close');
      setStatus('Verbinding verbroken');
    });
  }

  function send(payload) {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(payload));
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
        window.onSyncResults();
      }
    }
    if (msg.type === 'start') {
      window.startQuestions && window.startQuestions();
    }
    if (msg.type === 'results') {
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
