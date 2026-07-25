(() => {
  'use strict';

  const CONFIG = {
    easy: { rows: 2, cols: 5, label: 'Fácil' },
    medium: { rows: 5, cols: 6, label: 'Médio' },
    hard: { rows: 6, cols: 10, label: 'Avançado' }
  };

  const els = {
    imageInput: document.querySelector('#imageInput'),
    startBtn: document.querySelector('#startBtn'),
    resetBtn: document.querySelector('#resetBtn'),
    installBtn: document.querySelector('#installBtn'),
    guideCanvas: document.querySelector('#guideCanvas'),
    board: document.querySelector('#board'),
    boardWrap: document.querySelector('#boardWrap'),
    tray: document.querySelector('#tray'),
    emptyState: document.querySelector('#emptyState'),
    progressText: document.querySelector('#progressText'),
    attemptsText: document.querySelector('#attemptsText'),
    timerText: document.querySelector('#timerText'),
    statusText: document.querySelector('#statusText'),
    trayCount: document.querySelector('#trayCount'),
    successModal: document.querySelector('#successModal'),
    successSummary: document.querySelector('#successSummary'),
    playAgainBtn: document.querySelector('#playAgainBtn')
  };

  const state = {
    image: null,
    imageUrl: null,
    difficulty: 'easy',
    pieces: [],
    board: { x: 0, y: 0, width: 0, height: 0 },
    solved: 0,
    attempts: 0,
    timerId: null,
    startedAt: 0,
    running: false,
    deferredPrompt: null,
    resizeTimer: null
  };

  function selectedDifficulty() {
    return document.querySelector('input[name="difficulty"]:checked')?.value || 'easy';
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateStatus(message) {
    els.statusText.textContent = message;
  }

  function updateCounters() {
    els.progressText.textContent = `${state.solved}/${state.pieces.length || 0}`;
    els.attemptsText.textContent = String(state.attempts);
    els.trayCount.textContent = `${Math.max(0, state.pieces.length - state.solved)} disponíveis`;
  }

  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    els.timerText.textContent = '00:00';
    state.timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      els.timerText.textContent = formatTime(elapsed);
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function seededEdge(row, col, side, rows, cols) {
    if ((side === 'top' && row === 0) ||
        (side === 'bottom' && row === rows - 1) ||
        (side === 'left' && col === 0) ||
        (side === 'right' && col === cols - 1)) return 0;

    const horizontal = side === 'top' || side === 'bottom';
    const keyRow = horizontal ? (side === 'top' ? row - 1 : row) : row;
    const keyCol = horizontal ? col : (side === 'left' ? col - 1 : col);
    const seed = ((keyRow + 11) * 92821 + (keyCol + 7) * 68917 + (horizontal ? 17 : 31)) >>> 0;
    const sign = seed % 2 === 0 ? 1 : -1;
    return (side === 'top' || side === 'left') ? -sign : sign;
  }

  function getEdges(row, col, rows, cols) {
    return {
      top: seededEdge(row, col, 'top', rows, cols),
      right: seededEdge(row, col, 'right', rows, cols),
      bottom: seededEdge(row, col, 'bottom', rows, cols),
      left: seededEdge(row, col, 'left', rows, cols)
    };
  }

  function makePiecePath(ctx, x, y, w, h, tab, edges) {
    const t = tab;
    ctx.beginPath();
    ctx.moveTo(x, y);

    // top
    if (!edges.top) ctx.lineTo(x + w, y);
    else {
      ctx.lineTo(x + w * 0.34, y);
      ctx.bezierCurveTo(x + w * 0.39, y, x + w * 0.39, y + edges.top * t, x + w * 0.5, y + edges.top * t);
      ctx.bezierCurveTo(x + w * 0.61, y + edges.top * t, x + w * 0.61, y, x + w * 0.66, y);
      ctx.lineTo(x + w, y);
    }

    // right
    if (!edges.right) ctx.lineTo(x + w, y + h);
    else {
      ctx.lineTo(x + w, y + h * 0.34);
      ctx.bezierCurveTo(x + w, y + h * 0.39, x + w + edges.right * t, y + h * 0.39, x + w + edges.right * t, y + h * 0.5);
      ctx.bezierCurveTo(x + w + edges.right * t, y + h * 0.61, x + w, y + h * 0.61, x + w, y + h * 0.66);
      ctx.lineTo(x + w, y + h);
    }

    // bottom
    if (!edges.bottom) ctx.lineTo(x, y + h);
    else {
      ctx.lineTo(x + w * 0.66, y + h);
      ctx.bezierCurveTo(x + w * 0.61, y + h, x + w * 0.61, y + h + edges.bottom * t, x + w * 0.5, y + h + edges.bottom * t);
      ctx.bezierCurveTo(x + w * 0.39, y + h + edges.bottom * t, x + w * 0.39, y + h, x + w * 0.34, y + h);
      ctx.lineTo(x, y + h);
    }

    // left
    if (!edges.left) ctx.lineTo(x, y);
    else {
      ctx.lineTo(x, y + h * 0.66);
      ctx.bezierCurveTo(x, y + h * 0.61, x + edges.left * t, y + h * 0.61, x + edges.left * t, y + h * 0.5);
      ctx.bezierCurveTo(x + edges.left * t, y + h * 0.39, x, y + h * 0.39, x, y + h * 0.34);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fitBoard(img, container, ratio) {
    const maxW = Math.max(260, container.clientWidth - 40);
    const maxH = Math.max(260, container.clientHeight - 40);
    const imageRatio = ratio || img.width / img.height;
    let width = maxW;
    let height = width / imageRatio;
    if (height > maxH) {
      height = maxH;
      width = height * imageRatio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  }

  function createPieceCanvas(piece, sourceCanvas) {
    const scale = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.className = 'piece';
    canvas.dataset.id = piece.id;
    canvas.width = Math.ceil(piece.canvasW * scale);
    canvas.height = Math.ceil(piece.canvasH * scale);
    canvas.style.width = `${piece.canvasW}px`;
    canvas.style.height = `${piece.canvasH}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.save();
    makePiecePath(ctx, piece.pad, piece.pad, piece.w, piece.h, piece.tab, piece.edges);
    ctx.clip();
    ctx.drawImage(
      sourceCanvas,
      piece.col * piece.w - piece.pad,
      piece.row * piece.h - piece.pad,
      piece.canvasW,
      piece.canvasH,
      0, 0,
      piece.canvasW,
      piece.canvasH
    );
    ctx.restore();

    ctx.save();
    makePiecePath(ctx, piece.pad, piece.pad, piece.w, piece.h, piece.tab, piece.edges);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    bindPieceEvents(canvas, piece);
    return canvas;
  }

  function renderGuide(sourceCanvas) {
    const { width, height } = state.board;
    const scale = window.devicePixelRatio || 1;
    els.guideCanvas.width = width * scale;
    els.guideCanvas.height = height * scale;
    els.guideCanvas.style.width = `${width}px`;
    els.guideCanvas.style.height = `${height}px`;
    const ctx = els.guideCanvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  function scatterPieces() {
    const trayRect = els.tray.getBoundingClientRect();
    state.pieces.forEach((piece, index) => {
      const el = piece.el;
      const maxX = Math.max(0, trayRect.width - piece.canvasW - 8);
      const maxY = Math.max(0, trayRect.height - piece.canvasH - 8);
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
      els.tray.appendChild(el);
      piece.home = { x, y };
      piece.container = 'tray';
      piece.locked = false;
      piece.el.classList.remove('locked');
    });
  }

  function buildGame() {
    if (!state.image) return;

    state.difficulty = selectedDifficulty();
    const { rows, cols } = CONFIG[state.difficulty];
    const dimensions = fitBoard(state.image, els.boardWrap);
    const pieceW = dimensions.width / cols;
    const pieceH = dimensions.height / rows;
    const tab = Math.min(pieceW, pieceH) * 0.22;
    const pad = Math.ceil(tab + 3);

    state.board = {
      width: dimensions.width,
      height: dimensions.height,
      x: (els.boardWrap.clientWidth - dimensions.width) / 2,
      y: (els.boardWrap.clientHeight - dimensions.height) / 2
    };

    els.board.innerHTML = '';
    els.tray.innerHTML = '';
    els.emptyState.hidden = true;
    els.guideCanvas.style.left = `${state.board.x}px`;
    els.guideCanvas.style.top = `${state.board.y}px`;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = dimensions.width;
    sourceCanvas.height = dimensions.height;
    sourceCanvas.getContext('2d').drawImage(state.image, 0, 0, dimensions.width, dimensions.height);
    renderGuide(sourceCanvas);

    state.pieces = [];
    state.solved = 0;
    state.attempts = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = `${row}-${col}`;
        const piece = {
          id, row, col,
          w: pieceW,
          h: pieceH,
          tab,
          pad,
          canvasW: pieceW + pad * 2,
          canvasH: pieceH + pad * 2,
          edges: getEdges(row, col, rows, cols),
          targetX: state.board.x + col * pieceW - pad,
          targetY: state.board.y + row * pieceH - pad,
          locked: false,
          el: null
        };
        piece.el = createPieceCanvas(piece, sourceCanvas);
        state.pieces.push(piece);
      }
    }

    shuffle(state.pieces);
    scatterPieces();
    updateCounters();
    updateStatus('Em andamento');
    state.running = true;
    els.resetBtn.disabled = false;
    startTimer();
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function bindPieceEvents(el, piece) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    el.addEventListener('pointerdown', (event) => {
      if (!state.running || piece.locked) return;
      event.preventDefault();
      dragging = true;
      el.setPointerCapture(event.pointerId);
      el.classList.add('dragging');

      const rect = el.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      if (piece.container !== 'board') {
        const boardRect = els.boardWrap.getBoundingClientRect();
        els.boardWrap.appendChild(el);
        el.style.left = `${event.clientX - boardRect.left - offsetX}px`;
        el.style.top = `${event.clientY - boardRect.top - offsetY}px`;
        el.style.transform = 'rotate(0deg)';
        piece.container = 'board';
      }
    });

    el.addEventListener('pointermove', (event) => {
      if (!dragging || piece.locked) return;
      const boardRect = els.boardWrap.getBoundingClientRect();
      el.style.left = `${event.clientX - boardRect.left - offsetX}px`;
      el.style.top = `${event.clientY - boardRect.top - offsetY}px`;
    });

    const release = (event) => {
      if (!dragging || piece.locked) return;
      dragging = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(event.pointerId); } catch (_) {}
      testDrop(piece);
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  function testDrop(piece) {
    state.attempts += 1;
    const currentX = parseFloat(piece.el.style.left) || 0;
    const currentY = parseFloat(piece.el.style.top) || 0;
    const distance = Math.hypot(currentX - piece.targetX, currentY - piece.targetY);
    const tolerance = Math.max(20, Math.min(piece.w, piece.h) * 0.34);

    if (distance <= tolerance) {
      piece.el.style.left = `${piece.targetX}px`;
      piece.el.style.top = `${piece.targetY}px`;
      piece.el.style.transform = 'rotate(0deg)';
      piece.el.classList.add('locked', 'correct-flash');
      piece.locked = true;
      state.solved += 1;
      setTimeout(() => piece.el.classList.remove('correct-flash'), 650);
      updateStatus('Encaixe correto');
      if (state.solved === state.pieces.length) finishGame();
    } else {
      piece.el.classList.add('wrong-flash');
      updateStatus('Posição incorreta');
      setTimeout(() => piece.el.classList.remove('wrong-flash'), 500);
    }
    updateCounters();
  }

  function finishGame() {
    state.running = false;
    stopTimer();
    updateStatus('Concluído');
    const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    els.successSummary.textContent = `Nível ${CONFIG[state.difficulty].label}, ${state.pieces.length} peças, ${state.attempts} tentativas e tempo de ${formatTime(seconds)}.`;
    els.successModal.hidden = false;
  }

  function resetGame() {
    if (!state.image) return;
    buildGame();
  }

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      updateStatus('Arquivo inválido');
      return;
    }
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.image = img;
      els.startBtn.disabled = false;
      updateStatus('Imagem pronta');
    };
    img.onerror = () => updateStatus('Não foi possível abrir a imagem');
    img.src = state.imageUrl;
  }

  els.imageInput.addEventListener('change', (event) => {
    loadImageFile(event.target.files?.[0]);
  });

  els.startBtn.addEventListener('click', buildGame);
  els.resetBtn.addEventListener('click', resetGame);
  els.playAgainBtn.addEventListener('click', () => {
    els.successModal.hidden = true;
    resetGame();
  });

  els.successModal.addEventListener('click', (event) => {
    if (event.target === els.successModal) els.successModal.hidden = true;
  });

  window.addEventListener('resize', () => {
    if (!state.running || !state.image) return;
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(buildGame, 250);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js');
        registration.update();
      } catch (error) {
        console.error('Falha ao registrar o modo offline:', error);
      }
    });
  }
})();
