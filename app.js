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
    rotateBtn: document.querySelector('#rotateBtn'),
    advancedHelp: document.querySelector('#advancedHelp'),
    installBtn: document.querySelector('#installBtn'),
    showGuide: document.querySelector('#showGuide'),
    guideCanvas: document.querySelector('#guideCanvas'),
    finalCanvas: document.querySelector('#finalCanvas'),
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
    sameImageBtn: document.querySelector('#sameImageBtn'),
    otherImageBtn: document.querySelector('#otherImageBtn'),
    newGameModal: document.querySelector('#newGameModal'),
    confirmSameImageBtn: document.querySelector('#confirmSameImageBtn'),
    confirmOtherImageBtn: document.querySelector('#confirmOtherImageBtn'),
    cancelNewGameBtn: document.querySelector('#cancelNewGameBtn'),
    gamePanel: document.querySelector('.game-panel'),
    workspace: document.querySelector('#workspace'),
    confettiCanvas: document.querySelector('#confettiCanvas')
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
    resizeTimer: null,
    showGuide: true,
    selectedPieceId: null,
    sourceCanvas: null,
    confettiFrame: null,
    confettiStopTimer: null
  };

  function scrollToGameArea() {
    const target = els.workspace || els.gamePanel;
    if (!target) return;

    // No celular, posiciona imediatamente o início da área do quebra-cabeça
    // para que o usuário já veja onde deve começar a jogar.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 8);
        window.scrollTo({ top, behavior: 'auto' });
      });
    });
  }

  function stopConfetti() {
    if (state.confettiFrame) window.cancelAnimationFrame(state.confettiFrame);
    if (state.confettiStopTimer) window.clearTimeout(state.confettiStopTimer);
    state.confettiFrame = null;
    state.confettiStopTimer = null;
    if (!els.confettiCanvas) return;
    const ctx = els.confettiCanvas.getContext('2d');
    ctx?.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);
    els.confettiCanvas.hidden = true;
  }

  function launchConfetti() {
    const canvas = els.confettiCanvas;
    if (!canvas) return;
    stopConfetti();

    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.hidden = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette = ['#6d28d9', '#16a34a', '#f59e0b', '#ec4899', '#0ea5e9', '#ef4444'];
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.45,
      w: 5 + Math.random() * 8,
      h: 7 + Math.random() * 10,
      vx: -2.2 + Math.random() * 4.4,
      vy: 2.5 + Math.random() * 4.5,
      gravity: 0.035 + Math.random() * 0.055,
      rotation: Math.random() * Math.PI * 2,
      spin: -0.18 + Math.random() * 0.36,
      color: palette[Math.floor(Math.random() * palette.length)],
      opacity: 0.85 + Math.random() * 0.15
    }));

    const started = performance.now();
    const duration = 4200;

    const animate = (now) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);

      pieces.forEach((piece) => {
        piece.vy += piece.gravity;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;

        if (piece.x < -30) piece.x = width + 30;
        if (piece.x > width + 30) piece.x = -30;

        const fade = elapsed > duration - 850 ? Math.max(0, (duration - elapsed) / 850) : 1;
        ctx.save();
        ctx.globalAlpha = piece.opacity * fade;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      });

      if (elapsed < duration) {
        state.confettiFrame = window.requestAnimationFrame(animate);
      } else {
        stopConfetti();
      }
    };

    state.confettiFrame = window.requestAnimationFrame(animate);
    state.confettiStopTimer = window.setTimeout(stopConfetti, duration + 300);
  }

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

  function isAdvancedMode() {
    return state.running ? state.difficulty === 'hard' : selectedDifficulty() === 'hard';
  }

  function normalizedRotation(value) {
    return ((Number(value) % 360) + 360) % 360;
  }

  function selectedPiece() {
    return state.pieces.find((piece) => piece.id === state.selectedPieceId) || null;
  }

  function updateRotationControls() {
    const advanced = isAdvancedMode();
    els.rotateBtn.hidden = !advanced;
    els.advancedHelp.hidden = !advanced;
    const piece = selectedPiece();
    els.rotateBtn.disabled = !advanced || !state.running || !piece || piece.locked;
  }

  function selectPiece(piece) {
    state.pieces.forEach((item) => item.el?.classList.remove('selected'));
    state.selectedPieceId = piece && !piece.locked ? piece.id : null;
    if (piece && !piece.locked) piece.el.classList.add('selected');
    updateRotationControls();
  }

  function rotatePiece(piece) {
    if (!piece || piece.locked || state.difficulty !== 'hard') return;
    piece.rotation = normalizedRotation((piece.rotation || 0) + 90);
    piece.homeRotation = piece.rotation;
    piece.el.style.transform = `rotate(${piece.rotation}deg)`;
    selectPiece(piece);
    updateStatus(`Peça girada para ${piece.rotation}°`);
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
      piece.srcX - piece.pad,
      piece.srcY - piece.pad,
      piece.canvasW,
      piece.canvasH,
      0, 0,
      piece.canvasW,
      piece.canvasH
    );
    ctx.restore();


    bindPieceEvents(canvas, piece);
    return canvas;
  }

  function renderLockedPiece(piece) {
    if (!piece?.el || !state.sourceCanvas) return;
    const scale = window.devicePixelRatio || 1;
    piece.el.width = Math.ceil(piece.w * scale);
    piece.el.height = Math.ceil(piece.h * scale);
    piece.el.style.width = `${piece.w}px`;
    piece.el.style.height = `${piece.h}px`;
    const ctx = piece.el.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, piece.el.width, piece.el.height);
    ctx.scale(scale, scale);
    ctx.drawImage(
      state.sourceCanvas,
      piece.srcX,
      piece.srcY,
      piece.w,
      piece.h,
      0,
      0,
      piece.w,
      piece.h
    );
  }



  function hideFinalPreview() {
    if (!els.finalCanvas) return;
    els.finalCanvas.hidden = true;
    const ctx = els.finalCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.finalCanvas.width, els.finalCanvas.height);
  }

  function renderFinalPreview() {
    if (!els.finalCanvas || !state.sourceCanvas) return;
    const { width, height, x, y } = state.board;
    const scale = window.devicePixelRatio || 1;
    els.finalCanvas.width = Math.round(width * scale);
    els.finalCanvas.height = Math.round(height * scale);
    els.finalCanvas.style.width = `${width}px`;
    els.finalCanvas.style.height = `${height}px`;
    els.finalCanvas.style.left = `${x}px`;
    els.finalCanvas.style.top = `${y}px`;

    const ctx = els.finalCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.finalCanvas.width, els.finalCanvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(state.sourceCanvas, 0, 0, width, height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    state.pieces.forEach((piece) => {
      makePiecePath(ctx, piece.srcX, piece.srcY, piece.w, piece.h, piece.tab, piece.edges);
      ctx.stroke();
    });

    els.finalCanvas.hidden = false;
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
    updateGuideVisibility();
  }

  function updateGuideVisibility() {
    state.showGuide = Boolean(els.showGuide?.checked);
    els.guideCanvas.classList.toggle('guide-hidden', !state.showGuide);
  }

  function returnPieceToTray(piece, { flash = false } = {}) {
    const trayRect = els.tray.getBoundingClientRect();
    const maxX = Math.max(0, trayRect.width - piece.canvasW - 8);
    const maxY = Math.max(0, trayRect.height - piece.canvasH - 8);
    const homeX = Math.min(Math.max(0, piece.home?.x ?? Math.random() * maxX), maxX);
    const homeY = Math.min(Math.max(0, piece.home?.y ?? Math.random() * maxY), maxY);

    els.tray.appendChild(piece.el);
    piece.el.classList.remove('dragging', 'drag-layer');
    piece.el.style.left = `${homeX}px`;
    piece.el.style.top = `${homeY}px`;
    piece.el.style.width = `${piece.canvasW}px`;
    piece.el.style.height = `${piece.canvasH}px`;
    piece.el.style.transform = `rotate(${piece.homeRotation ?? piece.rotation ?? 0}deg)`;
    piece.container = 'tray';

    if (flash) {
      piece.el.classList.add('wrong-flash');
      window.setTimeout(() => piece.el.classList.remove('wrong-flash'), 500);
    }
  }

  function scatterPieces() {
    const trayRect = els.tray.getBoundingClientRect();
    state.pieces.forEach((piece) => {
      const maxX = Math.max(0, trayRect.width - piece.canvasW - 8);
      const maxY = Math.max(0, trayRect.height - piece.canvasH - 8);
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      piece.home = { x, y };
      piece.rotation = state.difficulty === 'hard'
        ? [0, 90, 180, 270][Math.floor(Math.random() * 4)]
        : 0;
      piece.homeRotation = state.difficulty === 'hard'
        ? piece.rotation
        : Number((Math.random() * 8 - 4).toFixed(1));
      piece.locked = false;
      piece.el.classList.remove('locked', 'selected', 'correct-flash', 'wrong-flash');
      returnPieceToTray(piece);
    });
  }

  function buildGame({ autoScroll = true } = {}) {
    if (!state.image) return;

    state.difficulty = selectedDifficulty();
    const { rows, cols } = CONFIG[state.difficulty];
    const dimensions = fitBoard(state.image, els.boardWrap);
    const colStarts = Array.from({ length: cols + 1 }, (_, index) => Math.round(index * dimensions.width / cols));
    const rowStarts = Array.from({ length: rows + 1 }, (_, index) => Math.round(index * dimensions.height / rows));
    const sampleW = Math.max(1, colStarts[1] - colStarts[0]);
    const sampleH = Math.max(1, rowStarts[1] - rowStarts[0]);
    const tab = Math.min(sampleW, sampleH) * 0.22;
    const pad = Math.ceil(tab + 3);

    state.board = {
      width: dimensions.width,
      height: dimensions.height,
      x: Math.round((els.boardWrap.clientWidth - dimensions.width) / 2),
      y: Math.round((els.boardWrap.clientHeight - dimensions.height) / 2)
    };

    els.board.innerHTML = '';
    els.tray.innerHTML = '';
    els.emptyState.hidden = true;
    hideFinalPreview();
    els.guideCanvas.style.left = `${state.board.x}px`;
    els.guideCanvas.style.top = `${state.board.y}px`;
    if (els.finalCanvas) {
      els.finalCanvas.style.left = `${state.board.x}px`;
      els.finalCanvas.style.top = `${state.board.y}px`;
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = dimensions.width;
    sourceCanvas.height = dimensions.height;
    sourceCanvas.getContext('2d').drawImage(state.image, 0, 0, dimensions.width, dimensions.height);
    state.sourceCanvas = sourceCanvas;
    renderGuide(sourceCanvas);

    state.pieces = [];
    state.solved = 0;
    state.attempts = 0;
    state.selectedPieceId = null;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = `${row}-${col}`;
        const srcX = colStarts[col];
        const srcY = rowStarts[row];
        const pieceW = Math.max(1, colStarts[col + 1] - srcX);
        const pieceH = Math.max(1, rowStarts[row + 1] - srcY);
        const piece = {
          id, row, col,
          srcX,
          srcY,
          w: pieceW,
          h: pieceH,
          tab,
          pad,
          canvasW: pieceW + pad * 2,
          canvasH: pieceH + pad * 2,
          edges: getEdges(row, col, rows, cols),
          targetX: state.board.x + srcX - pad,
          targetY: state.board.y + srcY - pad,
          locked: false,
          rotation: 0,
          homeRotation: 0,
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
    updateRotationControls();
    els.resetBtn.disabled = false;
    startTimer();
    if (autoScroll) scrollToGameArea();
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function bindPieceEvents(el, piece) {
    let dragging = false;
    let moved = false;
    let offsetX = 0;
    let offsetY = 0;
    let startClientX = 0;
    let startClientY = 0;

    el.addEventListener('pointerdown', (event) => {
      if (!state.running || piece.locked) return;
      event.preventDefault();
      dragging = true;
      moved = false;
      startClientX = event.clientX;
      startClientY = event.clientY;
      if (state.difficulty === 'hard') selectPiece(piece);

      const rect = el.getBoundingClientRect();
      // Mantém o centro visual da peça mesmo quando ela está girada em 90°/270°.
      const fixedLeft = rect.left + rect.width / 2 - piece.canvasW / 2;
      const fixedTop = rect.top + rect.height / 2 - piece.canvasH / 2;
      offsetX = event.clientX - fixedLeft;
      offsetY = event.clientY - fixedTop;

      // Move a peça para uma camada fixa durante o arraste. Isso evita que ela
      // desapareça ao sair da bandeja ou entrar em um contêiner com overflow.
      document.body.appendChild(el);
      el.classList.add('dragging', 'drag-layer');
      el.style.left = `${fixedLeft}px`;
      el.style.top = `${fixedTop}px`;
      el.style.width = `${piece.canvasW}px`;
      el.style.height = `${piece.canvasH}px`;
      el.style.transform = `rotate(${piece.rotation || 0}deg) scale(1.035)`;

      try { el.setPointerCapture(event.pointerId); } catch (_) {}
    });

    el.addEventListener('pointermove', (event) => {
      if (!dragging || piece.locked) return;
      event.preventDefault();
      if (Math.hypot(event.clientX - startClientX, event.clientY - startClientY) > 8) moved = true;
      el.style.left = `${event.clientX - offsetX}px`;
      el.style.top = `${event.clientY - offsetY}px`;
    });

    const release = (event, cancelled = false) => {
      if (!dragging || piece.locked) return;
      dragging = false;
      try { el.releasePointerCapture(event.pointerId); } catch (_) {}

      if (cancelled) {
        returnPieceToTray(piece);
        updateStatus('Peça devolvida ao monte');
        return;
      }

      // No Avançado, um toque curto gira a peça sem registrar uma tentativa.
      if (state.difficulty === 'hard' && !moved) {
        rotatePiece(piece);
        returnPieceToTray(piece);
        return;
      }

      const fixedLeft = parseFloat(el.style.left) || 0;
      const fixedTop = parseFloat(el.style.top) || 0;
      const boardRect = els.boardWrap.getBoundingClientRect();
      els.boardWrap.appendChild(el);
      el.classList.remove('dragging', 'drag-layer');
      el.style.left = `${fixedLeft - boardRect.left}px`;
      el.style.top = `${fixedTop - boardRect.top}px`;
      el.style.transform = `rotate(${piece.rotation || 0}deg)`;
      piece.container = 'board';
      testDrop(piece);
    };

    el.addEventListener('pointerup', (event) => release(event));
    el.addEventListener('pointercancel', (event) => release(event, true));
  }

  function testDrop(piece) {
    state.attempts += 1;
    const currentX = parseFloat(piece.el.style.left) || 0;
    const currentY = parseFloat(piece.el.style.top) || 0;
    const distance = Math.hypot(currentX - piece.targetX, currentY - piece.targetY);
    const tolerance = Math.max(20, Math.min(piece.w, piece.h) * 0.34);

    const autoRotated = normalizedRotation(piece.rotation || 0) !== 0;

    if (distance <= tolerance) {
      piece.locked = true;
      piece.rotation = 0;
      piece.homeRotation = 0;
      piece.el.style.left = `${piece.targetX}px`;
      piece.el.style.top = `${piece.targetY}px`;
      piece.el.style.transform = 'rotate(0deg)';
      if (state.selectedPieceId === piece.id) state.selectedPieceId = null;
      piece.el.classList.remove('selected');
      updateRotationControls();

      const finalizeLock = () => {
        renderLockedPiece(piece);
        piece.el.style.left = `${state.board.x + piece.srcX}px`;
        piece.el.style.top = `${state.board.y + piece.srcY}px`;
        piece.el.classList.add('locked', 'correct-flash');
        state.solved += 1;
        updateCounters();
        setTimeout(() => piece.el.classList.remove('correct-flash'), 650);
        updateStatus(autoRotated ? 'Peça girou e encaixou corretamente' : 'Encaixe correto');
        if (state.solved === state.pieces.length) finishGame();
      };

      if (autoRotated) {
        setTimeout(finalizeLock, 170);
      } else {
        finalizeLock();
      }
    } else {
      returnPieceToTray(piece, { flash: true });
      updateStatus('Posição incorreta — peça devolvida ao monte');
      updateCounters();
    }
  }

  function closeSuccessModal() {
    els.successModal.hidden = true;
  }

  function closeNewGameModal() {
    if (els.newGameModal) els.newGameModal.hidden = true;
  }

  function openNewGameModal() {
    if (!state.image) return;
    closeSuccessModal();
    if (els.newGameModal) els.newGameModal.hidden = false;
  }

  function clearGuideCanvas() {
    const ctx = els.guideCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.guideCanvas.width, els.guideCanvas.height);
  }

  function clearBoard({ clearImage = false } = {}) {
    stopConfetti();
    stopTimer();
    state.running = false;
    state.pieces = [];
    state.solved = 0;
    state.attempts = 0;
    state.selectedPieceId = null;
    state.sourceCanvas = null;
    els.board.innerHTML = '';
    els.tray.innerHTML = '';
    els.emptyState.hidden = false;
    hideFinalPreview();
    clearGuideCanvas();
    els.timerText.textContent = '00:00';
    if (clearImage) {
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageUrl = null;
      state.image = null;
      els.imageInput.value = '';
    }
    updateCounters();
    updateRotationControls();
    els.startBtn.disabled = !state.image;
    els.resetBtn.disabled = !state.image;
    updateStatus(state.image ? 'Imagem pronta' : 'Envie uma imagem');
  }

  function startNewGameWithSameImage() {
    if (!state.image) return;

    closeSuccessModal();
    closeNewGameModal();
    document.documentElement.classList.add('game-reloading');
    updateStatus('Recomeçando do zero…');

    // Ao escolher a mesma imagem, o tabuleiro volta a ficar completamente vazio.
    // Apenas a imagem continua carregada e todas as peças são recriadas no monte.
    els.showGuide.checked = false;
    updateGuideVisibility();
    clearBoard({ clearImage: false });
    state.board = { x: 0, y: 0, width: 0, height: 0 };
    state.startedAt = 0;

    // Aguarda a limpeza visual e recria a rodada desde o zero.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        buildGame({ autoScroll: true });
        document.documentElement.classList.remove('game-reloading');
      });
    });
  }

  function startNewGameWithOtherImage() {
    closeSuccessModal();
    closeNewGameModal();
    clearBoard({ clearImage: true });
  }

  function finishGame() {
    state.running = false;
    updateRotationControls();
    stopTimer();
    renderFinalPreview();
    updateStatus('Parabéns!');
    const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    els.successSummary.textContent = `Você concluiu o nível ${CONFIG[state.difficulty].label} com ${state.pieces.length} peças, ${state.attempts} tentativas e tempo de ${formatTime(seconds)}.`;
    els.successModal.hidden = false;
    launchConfetti();
  }

  function resetGame() {
    if (!state.image) return;
    openNewGameModal();
  }

  function loadImageFile(file) {
    stopConfetti();
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


  document.querySelectorAll('input[name="difficulty"]').forEach((input) => {
    input.addEventListener('change', updateRotationControls);
  });
  els.rotateBtn.addEventListener('click', () => rotatePiece(selectedPiece()));
  els.showGuide.addEventListener('change', updateGuideVisibility);
  els.startBtn.addEventListener('click', buildGame);
  els.resetBtn.addEventListener('click', resetGame);
  els.sameImageBtn.addEventListener('click', startNewGameWithSameImage);
  els.otherImageBtn.addEventListener('click', startNewGameWithOtherImage);
  els.confirmSameImageBtn.addEventListener('click', startNewGameWithSameImage);
  els.confirmOtherImageBtn.addEventListener('click', startNewGameWithOtherImage);
  els.cancelNewGameBtn.addEventListener('click', closeNewGameModal);

  els.successModal.addEventListener('click', (event) => {
    if (event.target === els.successModal) closeSuccessModal();
  });

  if (els.newGameModal) {
    els.newGameModal.addEventListener('click', (event) => {
      if (event.target === els.newGameModal) closeNewGameModal();
    });
  }

  window.addEventListener('resize', () => {
    if (!state.running || !state.image) return;
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => buildGame({ autoScroll: false }), 250);
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
