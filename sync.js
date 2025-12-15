// Lightweight client-side sync using WebSocket
// Requires server.js running locally (ws://localhost:3001)
(function(){
  // Aanpasbaar: zet hier je server-IP/poort.
  // Voor LAN gebruik je je interne IP; voor internet gebruik je je publieke IP met port forwarding.
  const WS_URL = 'ws://192.168.178.126:3001';
  let socket = null;
  let sessionId = 'default';
  let userName = null;
  let isReady = false;

  function connect(name) {
    userName = name;
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => {
      send({ type: 'join', sessionId, name: userName });
    });
    socket.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch (e) {
        console.warn('Bad message', e);
      }
    });
    socket.addEventListener('close', () => {
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

  function updateProgress(qIndex, total) {
    send({ type: 'progress', sessionId, name: userName, progress: { qIndex, total } });
  }

  function handleMessage(msg) {
    if (msg.type === 'state') {
      renderParticipants(msg.participants || []);
    }
    if (msg.type === 'start') {
      window.startQuestions && window.startQuestions();
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
      const ready = p.ready ? '✓' : '…';
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
  };
})();
