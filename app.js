(() => {
  const data = window.TrackTricksData || { maps: [], questions: [] };
  const maps = data.maps || [];
  const questions = (data.questions || []).map((q) => ({ ...q, options: maps }));
  const weights = [3, 2, 1]; // rank 1, 2, 3

  let currentIndex = 0;
  const selections = {}; // { questionId: [mapId, mapId, mapId] }
  let userName = localStorage.getItem("tracktricks_user") || "";
  let revealIndex = 0; // index van vraag in reveal flow
  let revealRank = 0; // welke plek binnen de vraag tonen we nu
  let revealTopThree = [];
  let revealTimers = [];
  let revealAnimating = false;
  let statsShown = false;
  let syncActive = false;

  // DOM refs
  const grid = document.getElementById("optionsGrid");
  const questionText = document.getElementById("questionText");
  const indicator = document.getElementById("questionIndicator");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resultsEl = document.getElementById("results");
  const revealQuestion = document.getElementById("revealQuestion");
  const revealCards = document.getElementById("revealCards");
  const revealNext = document.getElementById("revealNext");
  const skipBtn = document.getElementById("skipBtn");
  const revealContainer = document.querySelector(".reveal");
  const startScreen = document.getElementById("startScreen");
  const nameInput = document.getElementById("nameInput");
  const startBtn = document.getElementById("startBtn");
  const participantsFloat = document.getElementById("participantsFloat");
  const participantsList = document.getElementById("participantsList");
  const renameBtn = document.getElementById("renameBtn");
  const readyBtn = document.getElementById("readyBtn");
  const voteScreen = document.getElementById("voteScreen");
  const statsEl = document.getElementById("stats");

  function setIndicatorVisible(flag) {
    if (indicator) {
      indicator.style.display = flag ? "inline-flex" : "none";
    }
  }

  setIndicatorVisible(false);

  function renderQuestion() {
    const q = questions[currentIndex];
    if (!q) return;

    questionText.textContent = q.text;
    indicator.textContent = `Vraag ${currentIndex + 1} / ${questions.length}`;
    setIndicatorVisible(true);
    grid.innerHTML = "";
    const picked = selections[q.id] || [];
    const allowedSet = q.allowedIds ? new Set(q.allowedIds) : null;
    if (allowedSet) {
      selections[q.id] = picked.filter((id) => allowedSet.has(id));
    }

    q.options.forEach((opt, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.id = opt.id;

      const band = document.createElement("div");
      band.className = `band group-${Math.floor(idx / 5) + 1}`;

      const img = document.createElement("img");
      img.src = opt.image;
      img.alt = opt.label;

      const overlay = document.createElement("div");
      overlay.className = "title-overlay";
      overlay.textContent = opt.label;

      card.append(band, img, overlay);
      const isAllowed = !allowedSet || allowedSet.has(opt.id);
      if (isAllowed) {
        card.addEventListener("click", () => toggleSelect(opt.id));
      } else {
        card.classList.add("disabled");
      }
      grid.append(card);

      const rank = picked.indexOf(opt.id);
      if (rank !== -1) {
        card.classList.add("selected", `rank-${rank + 1}`);
        const badge = document.createElement("div");
        badge.className = "rank-badge";
        badge.textContent = rank + 1;
        card.append(badge);
      }
    });

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = picked.length < 3;
    nextBtn.textContent = currentIndex === questions.length - 1 ? "Resultaat tonen" : "Volgende vraag";
    resultsEl.style.display = "none";
    voteScreen.style.display = "block";
    updateParticipants();
    if (syncActive && window.Sync?.updateProgress) {
      window.Sync.updateProgress(currentIndex, questions.length);
    }
  }

  function toggleSelect(id) {
    const qid = questions[currentIndex].id;
    const picked = selections[qid] ? [...selections[qid]] : [];
    const allowedSet = questions[currentIndex].allowedIds ? new Set(questions[currentIndex].allowedIds) : null;
    if (allowedSet && !allowedSet.has(id)) return;
    const existing = picked.indexOf(id);

    if (existing !== -1) {
      picked.splice(existing, 1);
    } else {
      if (picked.length < 3) {
        picked.push(id); // eerste klik = rank 1, tweede = rank 2, derde = rank 3
      } else {
        picked[2] = id; // vervang rank 3 als er al drie keuzes zijn
      }
    }

    selections[qid] = picked;
    renderQuestion();
  }

  function computeQuestionScores(question, signed = false) {
    const scores = {};
    const picks = selections[question.id] || [];
    picks.forEach((mapId, idx) => {
      const base = weights[idx] || 0;
      const effective = signed && question.polarity === "negative" ? -base : base;
      scores[mapId] = (scores[mapId] || 0) + effective;
    });
    return scores;
  }

  function buildTopThree(q) {
    const scores = computeQuestionScores(q, true);
    const sorted = Object.entries(scores).sort((a, b) => {
      return q.polarity === "negative" ? a[1] - b[1] : b[1] - a[1];
    });
    return sorted.slice(0, 3).map(([mapId, pts]) => {
      const opt = maps.find((m) => m.id === mapId);
      return { ...opt, pts };
    });
  }

  function clearRevealTimers() {
    revealTimers.forEach((t) => clearTimeout(t));
    revealTimers = [];
  }

  function renderRevealCards() {
    revealCards.innerHTML = "";
    if (revealTopThree.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-row";
      empty.textContent = "Nog geen keuzes voor deze vraag.";
      revealCards.append(empty);
      return;
    }

    revealTopThree.forEach((item, rank) => {
      const card = document.createElement("div");
      card.className = "reveal-card";

      const badge = document.createElement("div");
      badge.className = "rank-badge";
      badge.textContent = rank + 1;

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.label;

      const overlay = document.createElement("div");
      overlay.className = "reveal-overlay";
      const title = document.createElement("div");
      title.className = "reveal-title";
      title.textContent = item.label;
      overlay.append(title);

      card.append(badge, img, overlay);
      revealCards.append(card);
    });
  }

  function updateRevealButton(idx) {
    const isLastQuestion = idx === questions.length - 1;
    if (revealTopThree.length === 0 || revealRank >= revealTopThree.length) {
      revealNext.textContent = isLastQuestion ? "Toon statistieken" : "Volgende vraagresultaat";
    } else {
      revealNext.textContent = "Toon volgende plek";
    }
  }

  function renderRevealForQuestion(idx) {
    const q = questions[idx];
    revealQuestion.textContent = `${idx + 1}. ${q.text}`;
    revealTopThree = buildTopThree(q);
    revealRank = 0;
    clearRevealTimers();
    revealContainer.style.display = "block";
    statsEl.style.display = "none";
    revealCards.style.display = "none";
    revealQuestion.classList.add("center-start");
    revealQuestion.classList.remove("stick-top");
    revealContainer.classList.add("question-only");
    revealNext.style.display = "none";
    renderRevealCards();
    setTimeout(() => {
      revealQuestion.classList.remove("center-start");
      revealQuestion.classList.add("stick-top");
      revealCards.style.display = "grid";
      revealContainer.classList.remove("question-only");
      runRevealSequence();
      updateRevealButton(idx);
      revealNext.style.display = "inline-flex";
      skipBtn.style.display = "inline-flex";
    }, 3000);
  }

  function runRevealSequence() {
    const cards = Array.from(revealCards.querySelectorAll(".reveal-card"));
    const order = [2, 1, 0].filter((i) => i < cards.length);

    if (order.length === 0) {
      revealNext.disabled = false;
      updateRevealButton(revealIndex);
      return;
    }

    revealAnimating = true;
    revealNext.disabled = true;

    order.forEach((cardIdx, step) => {
      const t = setTimeout(() => {
        const card = cards[cardIdx];
        if (card) {
          card.classList.add("show");
          revealRank = Math.max(revealRank, cards.length - cardIdx);
        }
        if (step === order.length - 1) {
          revealAnimating = false;
          revealNext.disabled = false;
          revealRank = cards.length;
          updateRevealButton(revealIndex);
        }
      }, step * 1200);
      revealTimers.push(t);
    });
  }

  function computeAndShowResults() {
    revealIndex = 0;
    statsShown = false;
    statsEl.style.display = "none";
    revealContainer.style.display = "block";
    revealNext.textContent = "Volgende vraagresultaat";
    renderRevealForQuestion(revealIndex);
    resultsEl.style.display = "block";
    voteScreen.style.display = "none";
    participantsFloat.style.display = "none";
    setIndicatorVisible(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nextBtn.addEventListener("click", () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      computeAndShowResults();
    }
  });

  revealNext.addEventListener("click", () => {
    if (revealAnimating) return;

    if (revealIndex < questions.length - 1) {
      revealIndex++;
      renderRevealForQuestion(revealIndex);
    } else {
      if (!statsShown) {
        statsShown = true;
        renderStats();
        revealNext.textContent = "Terug naar stemmen";
        return;
      }
      resultsEl.style.display = "none";
      voteScreen.style.display = "block";
      updateParticipants();
      setIndicatorVisible(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  skipBtn.addEventListener("click", () => {
    renderStats();
    revealContainer.style.display = "none";
    statsShown = true;
    revealNext.textContent = "Terug naar stemmen";
    skipBtn.style.display = "none";
  });

  // Statistieken (alleen positieve populariteit en persoonlijke favorieten)
  function renderStats() {
    const popularTotals = {};
    const favTotals = {};
    const posTotals = {};
    const negTotals = {};

    questions.forEach((q) => {
      const scores = computeQuestionScores(q, q.polarity === "negative");
      if (q.polarity === "positive") {
        Object.entries(scores).forEach(([mapId, pts]) => {
          popularTotals[mapId] = (popularTotals[mapId] || 0) + pts;
        });
        const picks = selections[q.id] || [];
        picks.forEach((mapId, idx) => {
          const pts = weights[idx] || 0;
          favTotals[mapId] = (favTotals[mapId] || 0) + pts;
        });
        Object.entries(scores).forEach(([mapId, pts]) => {
          posTotals[mapId] = (posTotals[mapId] || 0) + pts;
        });
      } else {
        Object.entries(scores).forEach(([mapId, pts]) => {
          const asPositive = Math.abs(pts);
          negTotals[mapId] = (negTotals[mapId] || 0) + asPositive;
        });
      }
    });

    const popularSorted = Object.entries(popularTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const favSorted = Object.entries(favTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const controversial = Object.keys(posTotals)
      .filter((id) => (posTotals[id] || 0) > 0 && (negTotals[id] || 0) > 0)
      .map((id) => {
        return {
          id,
          pos: posTotals[id] || 0,
          neg: negTotals[id] || 0,
          score: (posTotals[id] || 0) + (negTotals[id] || 0),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 1);

    const buildCards = (data, targetId, emptyText, showPosNeg = false, fullWidth = false) => {
      const target = document.getElementById(targetId);
      target.innerHTML = "";
      if (data.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-row";
        empty.textContent = emptyText;
        target.append(empty);
        return;
      }
      data.forEach((entry, idx) => {
        const mapId = Array.isArray(entry) ? entry[0] : entry.id;
        const pts = Array.isArray(entry) ? entry[1] : entry.score;
        const opt = maps.find((m) => m.id === mapId);
        const card = document.createElement("div");
        card.className = "stat-card";
        if (fullWidth) card.classList.add("controversial");

        const img = document.createElement("img");
        img.src = opt?.image || "";
        img.alt = opt?.label || mapId;

        const info = document.createElement("div");
        info.className = "stat-info";

        const name = document.createElement("div");
        name.className = "stat-name";
        name.textContent = `${idx + 1}. ${opt?.label || mapId}`;

        const val = document.createElement("div");
        val.className = "stat-points";
        if (showPosNeg && !Array.isArray(entry)) {
          val.textContent = `+${entry.pos} / -${entry.neg}`;
        } else {
          val.textContent = `${pts} punten`;
        }

        info.append(name, val);
        card.append(img, info);
        target.append(card);
      });
    };

    buildCards(popularSorted, "statsPopular", "Nog geen populaire maps.");
    buildCards(favSorted, "statsFavorites", "Nog geen favorieten.");
    buildCards(
      controversial.map((item) => [item.id, item.score, item]),
      "statsControversial",
      "Nog geen controversiële maps.",
      true,
      true
    );

    const byGroup = [1, 2, 3, 4, 5]
      .map((grp) => {
        const entries = Object.entries(popularTotals)
          .filter(([id]) => {
            const num = parseInt(id.replace(/\D/g, ""), 10);
            const group = Math.floor((num - 1) / 5) + 1;
            return group === grp;
          })
          .sort((a, b) => b[1] - a[1]);
        return entries.length ? entries[0] : null;
      })
      .filter(Boolean);

    const byGroupTarget = document.getElementById("statsByGroup");
    byGroupTarget.innerHTML = "";
    if (byGroup.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-row";
      empty.textContent = "Nog geen data.";
      byGroupTarget.append(empty);
    } else {
      byGroup.forEach(([mapId, pts], idx) => {
        const opt = maps.find((m) => m.id === mapId);
        const card = document.createElement("div");
        card.className = "stat-card color-card";
        card.style.borderLeftColor = ["#f5f5f5", "#31d47a", "#2d8cff", "#e94545", "#111111"][idx] || "#ffffff";
        const img = document.createElement("img");
        img.src = opt?.image || "";
        img.alt = opt?.label || mapId;
        const info = document.createElement("div");
        info.className = "stat-info";
        const name = document.createElement("div");
        name.className = "stat-name";
        name.textContent = `${["Wit", "Groen", "Blauw", "Rood", "Zwart"][idx] || "Groep"}: ${opt?.label || mapId}`;
        const val = document.createElement("div");
        val.className = "stat-points";
        val.textContent = `${pts} punten`;
        info.append(name, val);
        card.append(img, info);
        byGroupTarget.append(card);
      });
    }

    statsEl.style.display = "block";
    revealContainer.style.display = "none";
  }

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  });

  resetBtn.addEventListener("click", () => {
    const qid = questions[currentIndex].id;
    selections[qid] = [];
    renderQuestion();
  });

  function updateParticipants() {
    if (!userName) {
      participantsFloat.style.display = "none";
      return;
    }
    // Als sync actief is laten we sync.js het lijstje renderen
    if (syncActive) {
      participantsFloat.style.display = "block";
      return;
    }
    participantsFloat.style.display = "block";
    participantsList.innerHTML = "";
    const row = document.createElement("div");
    row.className = "participant-row";
    const nameEl = document.createElement("div");
    nameEl.className = "participant-name";
    nameEl.textContent = userName;
    const progress = document.createElement("div");
    progress.className = "participant-progress";
    progress.textContent = `${currentIndex + 1}/${questions.length}`;
    row.append(nameEl, progress);
    participantsList.append(row);
  }

  function startVoting() {
    const name = nameInput.value.trim();
    if (!name) return;
    userName = name;
    localStorage.setItem("tracktricks_user", name);
    startScreen.style.display = "none";
    voteScreen.style.display = "block";
    renderQuestion();
    updateParticipants();
    if (window.Sync) {
      syncActive = true;
      window.Sync.connect(userName);
      window.Sync.updateReady(false);
    }
  }

  startBtn.addEventListener("click", startVoting);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startVoting();
  });

  if (userName) {
    nameInput.value = userName;
    startScreen.style.display = "none";
    voteScreen.style.display = "block";
    renderQuestion();
    updateParticipants();
    if (window.Sync) {
      syncActive = true;
      window.Sync.connect(userName);
      window.Sync.updateReady(false);
    }
  }

  renameBtn.addEventListener("click", () => {
    userName = "";
    syncActive = false;
    localStorage.removeItem("tracktricks_user");
    startScreen.style.display = "grid";
    voteScreen.style.display = "none";
    setIndicatorVisible(false);
  });

  readyBtn.addEventListener("click", () => {
    readyBtn.classList.toggle("active");
    readyBtn.textContent = readyBtn.classList.contains("active") ? "Gereed" : "Ik ben er klaar voor";
    if (window.Sync && userName) {
      window.Sync.updateReady(readyBtn.classList.contains("active"));
    }
  });

  // expose startQuestions for server-triggered start
  window.startQuestions = () => {
    startScreen.style.display = "none";
    voteScreen.style.display = "block";
    renderQuestion();
    updateParticipants();
  };
})();
