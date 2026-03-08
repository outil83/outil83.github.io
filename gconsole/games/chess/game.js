/**
 * Chess — game.js
 * Intuitive flat-board chess: PvP + PvC (3 levels), save/resume, timers, full rules.
 *
 * Architecture:
 *  1. Pure engine (board, move-gen, AI) — no DOM
 *  2. State manager (save / load / scoring)
 *  3. UI layer (render, events, overlays)
 */

import StorageManager from '../../js/core/StorageManager.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const W = 'w';
const B = 'b';

/** Unicode glyphs — white = hollow, black = filled variant */
const GLYPH = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const PIECE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

/** Piece-square tables (white perspective, white rank-8 = index 0) */
const PST = {
  P: [ 0, 0, 0, 0, 0, 0, 0, 0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
  N: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
  B: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
  R: [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
  Q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
  K: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHESS ENGINE (pure functions, no DOM)
// ─────────────────────────────────────────────────────────────────────────────

function opp(c) { return c === W ? B : W; }

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function cloneBoard(b) { return b.map(row => row.map(p => p ? { ...p } : null)); }

function cloneChess(s) {
  return {
    board: cloneBoard(s.board),
    turn: s.turn,
    castling: { ...s.castling },
    enPassant: s.enPassant ? { ...s.enPassant } : null,
    halfmove: s.halfmove,
  };
}

function makeBoard() {
  const back = ['R','N','B','Q','K','B','N','R'];
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    g[0][c] = { type: back[c], color: B };
    g[1][c] = { type: 'P',     color: B };
    g[6][c] = { type: 'P',     color: W };
    g[7][c] = { type: back[c], color: W };
  }
  return g;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c].color === color)
        return { r, c };
  return null;
}

function isAttacked(board, r, c, byColor) {
  const pDir = byColor === W ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = r + pDir, pc = c + dc;
    if (inBounds(pr, pc) && board[pr][pc]?.type === 'P' && board[pr][pc].color === byColor) return true;
  }
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r+dr, nc = c+dc;
    if (inBounds(nr, nc) && board[nr][nc]?.type === 'N' && board[nr][nc].color === byColor) return true;
  }
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    for (let i = 1; i < 8; i++) {
      const nr = r+dr*i, nc = c+dc*i;
      if (!inBounds(nr, nc)) break;
      const p = board[nr][nc];
      if (p) { if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true; break; }
    }
  }
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    for (let i = 1; i < 8; i++) {
      const nr = r+dr*i, nc = c+dc*i;
      if (!inBounds(nr, nc)) break;
      const p = board[nr][nc];
      if (p) { if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true; break; }
    }
  }
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r+dr, nc = c+dc;
    if (inBounds(nr, nc) && board[nr][nc]?.type === 'K' && board[nr][nc].color === byColor) return true;
  }
  return false;
}

function inCheck(board, color) {
  const k = findKing(board, color);
  return k ? isAttacked(board, k.r, k.c, opp(color)) : false;
}

function pseudoMoves(board, r, c, chess) {
  const p = board[r][c];
  if (!p) return [];
  const { color, type } = p;
  const moves = [];

  const add = (tr, tc, special = null) => {
    if (!inBounds(tr, tc)) return;
    if (board[tr][tc]?.color === color) return;
    moves.push({ fromR: r, fromC: c, toR: tr, toC: tc, special });
  };

  const slide = (dirs) => {
    for (const [dr, dc] of dirs) {
      for (let i = 1; i < 8; i++) {
        const nr = r+dr*i, nc = c+dc*i;
        if (!inBounds(nr, nc)) break;
        const t = board[nr][nc];
        if (t && t.color === color) break;
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, special: null });
        if (t) break;
      }
    }
  };

  const { castling, enPassant } = chess;

  if (type === 'P') {
    const dir = color === W ? -1 : 1;
    const start = color === W ? 6 : 1;
    const promo = color === W ? 0 : 7;
    if (inBounds(r+dir, c) && !board[r+dir][c]) {
      add(r+dir, c, (r+dir) === promo ? 'promote' : null);
      if (r === start && !board[r+dir*2][c]) add(r+dir*2, c, 'double-push');
    }
    for (const dc of [-1, 1]) {
      const nr = r+dir, nc = c+dc;
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc]?.color === opp(color))
        add(nr, nc, nr === promo ? 'promote' : null);
      if (enPassant?.r === nr && enPassant?.c === nc)
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, special: 'en-passant' });
    }
  } else if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr, c+dc);
  } else if (type === 'B') {
    slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  } else if (type === 'R') {
    slide([[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type === 'Q') {
    slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type === 'K') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr, c+dc);
    const rank = color === W ? 7 : 0;
    if (r === rank && c === 4) {
      if (castling[color+'K'] && !board[rank][5] && !board[rank][6] && board[rank][7]?.type === 'R' && board[rank][7].color === color)
        moves.push({ fromR: rank, fromC: 4, toR: rank, toC: 6, special: 'castle-k' });
      if (castling[color+'Q'] && !board[rank][3] && !board[rank][2] && !board[rank][1] && board[rank][0]?.type === 'R' && board[rank][0].color === color)
        moves.push({ fromR: rank, fromC: 4, toR: rank, toC: 2, special: 'castle-q' });
    }
  }
  return moves;
}

/**
 * Apply a move. promoType: 'Q'|'R'|'B'|'N' (for promotion moves).
 */
function applyMove(board, chess, move) {
  const b = cloneBoard(board);
  const s = {
    turn: opp(chess.turn),
    castling: { ...chess.castling },
    enPassant: null,
    halfmove: chess.halfmove + 1,
  };

  const { fromR, fromC, toR, toC, special, promoType } = move;
  const piece = b[fromR][fromC];

  if (piece.type === 'P' || b[toR][toC]) s.halfmove = 0;

  const placed = special === 'promote'
    ? { type: promoType || 'Q', color: piece.color }
    : piece;
  b[toR][toC] = placed;
  b[fromR][fromC] = null;

  if (special === 'en-passant') b[piece.color === W ? toR+1 : toR-1][toC] = null;
  if (special === 'double-push') s.enPassant = { r: piece.color === W ? toR+1 : toR-1, c: toC };
  if (special === 'castle-k') { b[toR][7] = null; b[toR][5] = { type: 'R', color: piece.color }; }
  if (special === 'castle-q') { b[toR][0] = null; b[toR][3] = { type: 'R', color: piece.color }; }

  if (piece.type === 'K') { s.castling[piece.color+'K'] = false; s.castling[piece.color+'Q'] = false; }
  if (piece.type === 'R') {
    if (fromC === 7) s.castling[piece.color+'K'] = false;
    if (fromC === 0) s.castling[piece.color+'Q'] = false;
  }
  if (toR === 7 && toC === 7) s.castling[W+'K'] = false;
  if (toR === 7 && toC === 0) s.castling[W+'Q'] = false;
  if (toR === 0 && toC === 7) s.castling[B+'K'] = false;
  if (toR === 0 && toC === 0) s.castling[B+'Q'] = false;

  return { board: b, chess: s };
}

function isMoveLegal(board, chess, move) {
  if (move.special === 'castle-k') {
    const c = chess.turn;
    if (inCheck(board, c)) return false;
    if (isAttacked(board, move.toR, 5, opp(c))) return false;
    if (isAttacked(board, move.toR, 6, opp(c))) return false;
  }
  if (move.special === 'castle-q') {
    const c = chess.turn;
    if (inCheck(board, c)) return false;
    if (isAttacked(board, move.toR, 3, opp(c))) return false;
    if (isAttacked(board, move.toR, 2, opp(c))) return false;
  }
  const { board: nb } = applyMove(board, chess, move);
  return !inCheck(nb, chess.turn);
}

function legalMoves(board, chess, color) {
  const result = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.color !== color) continue;
      for (const m of pseudoMoves(board, r, c, chess))
        if (isMoveLegal(board, chess, m)) result.push(m);
    }
  return result;
}

function legalMovesForPiece(board, chess, r, c) {
  return pseudoMoves(board, r, c, chess).filter(m => isMoveLegal(board, chess, m));
}

// ─── Algebraic notation ───────────────────────────────────────────────────────

const FILES = 'abcdefgh';

function toAlg(board, move, allLegal) {
  if (move.special === 'castle-k') return 'O-O';
  if (move.special === 'castle-q') return 'O-O-O';
  const p = board[move.fromR][move.fromC];
  if (!p) return '?';
  const capture = board[move.toR][move.toC] || move.special === 'en-passant' ? 'x' : '';
  const toSq = FILES[move.toC] + (8 - move.toR);
  let prefix = p.type === 'P' ? (capture ? FILES[move.fromC] : '') : p.type;
  if (p.type !== 'P') {
    const amb = allLegal.filter(m =>
      m !== move &&
      board[m.fromR]?.[m.fromC]?.type === p.type &&
      board[m.fromR]?.[m.fromC]?.color === p.color &&
      m.toR === move.toR && m.toC === move.toC
    );
    if (amb.length) prefix += FILES[move.fromC];
  }
  const promo = move.special === 'promote' ? '=' + (move.promoType || 'Q') : '';
  return `${prefix}${capture}${toSq}${promo}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI
// ─────────────────────────────────────────────────────────────────────────────

function evalBoard(board) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const pstIdx = p.color === W ? r * 8 + c : (7-r) * 8 + (7-c);
      const val = (PIECE_VAL[p.type] * 100) + (PST[p.type]?.[pstIdx] ?? 0);
      score += p.color === W ? val : -val;
    }
  return score;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function minimax(board, chess, depth, alpha, beta, maxing) {
  const color = maxing ? W : B;
  const moves = legalMoves(board, chess, color);
  if (depth === 0 || !moves.length) {
    if (!moves.length) {
      if (inCheck(board, color)) return maxing ? -100000 + depth : 100000 - depth;
      return 0;
    }
    return evalBoard(board);
  }
  shuffle(moves);
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const { board: nb, chess: ns } = applyMove(board, chess, m);
    const v = minimax(nb, ns, depth - 1, alpha, beta, !maxing);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, best); }
    else        { best = Math.min(best, v); beta  = Math.min(beta,  best); }
    if (beta <= alpha) break;
  }
  return best;
}

/** Get AI move. level: 1=easy, 2=medium, 3=hard */
function getAIMove(board, chess, level) {
  const moves = legalMoves(board, chess, chess.turn);
  if (!moves.length) return null;

  if (level === 1) return moves[Math.floor(Math.random() * moves.length)];

  if (level === 2) {
    // Greedy: best immediate capture, else random
    const scored = moves.map(m => {
      const { board: nb } = applyMove(board, chess, m);
      return { m, v: evalBoard(nb) };
    });
    scored.sort((a, b) => chess.turn === W ? b.v - a.v : a.v - b.v);
    // Add slight randomness to avoid one-move blunders feeling robotic
    const topN = scored.slice(0, Math.min(3, scored.length));
    return topN[Math.floor(Math.random() * topN.length)].m;
  }

  // Level 3: minimax depth 4
  const isWhite = chess.turn === W;
  let bestMove = null;
  let bestVal = isWhite ? -Infinity : Infinity;
  shuffle(moves);
  for (const m of moves) {
    const { board: nb, chess: ns } = applyMove(board, chess, m);
    const v = minimax(nb, ns, 3, -Infinity, Infinity, !isWhite);
    if ((isWhite && v > bestVal) || (!isWhite && v < bestVal)) { bestVal = v; bestMove = m; }
  }
  return bestMove || moves[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PERSISTENCE & SCORING
// ─────────────────────────────────────────────────────────────────────────────

const SAVE_KEY   = 'chess_save';
const SCORES_KEY = 'chess_scores';

function getScores() {
  return StorageManager.get(SCORES_KEY) || {
    vsComputer: {
      1: { wins: 0, losses: 0, draws: 0 },
      2: { wins: 0, losses: 0, draws: 0 },
      3: { wins: 0, losses: 0, draws: 0 },
    },
    vsPlayer: { wins: 0, losses: 0, draws: 0 },
  };
}

function setScores(s) { StorageManager.set(SCORES_KEY, s); }

function recordResult(result /* 'win'|'loss'|'draw' */) {
  const sc = getScores();
  if (gs.mode === 'pvc') {
    const lvl = gs.aiLevel;
    sc.vsComputer[lvl][result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws']++;
  } else {
    sc.vsPlayer[result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws']++;
  }
  setScores(sc);
  StorageManager.logAudit('chess', `chess_${result}`, { mode: gs.mode, level: gs.aiLevel });
}

function saveGame() {
  if (!gs.active) return;
  StorageManager.set(SAVE_KEY, {
    mode: gs.mode, aiLevel: gs.aiLevel, humanColor: gs.humanColor,
    chess: cloneChess(gs.chess),
    timers: { ...gs.timers },
    history: [...gs.history],
    captured: {
      w: [...gs.captured.w],
      b: [...gs.captured.b],
    },
    lastMove: gs.lastMove ? { ...gs.lastMove } : null,
    savedAt: Date.now(),
  });
}

function loadSave() { return StorageManager.get(SAVE_KEY); }
function clearSave() { StorageManager.remove(SAVE_KEY); }

// ─────────────────────────────────────────────────────────────────────────────
// 5. GAME STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Global game state */
let gs = {};
let selectedSq = null;   // { r, c }
let selectedMoves = [];  // legal moves for selected piece
let pendingPromo = null; // move awaiting promotion choice
let boardFlipped = false;
let aiRunning = false;

// Timer
let timerInterval = null;

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (!gs.active) return;
    gs.timers[gs.chess.turn]++;
    renderTimers();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function fmtTime(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. UI — RENDER
// ─────────────────────────────────────────────────────────────────────────────

/** Convert logical (r,c) to display position when board is flipped */
function disp(r, c) {
  return boardFlipped ? { dr: 7-r, dc: 7-c } : { dr: r, dc: c };
}
function logical(dr, dc) {
  return boardFlipped ? { r: 7-dr, c: 7-dc } : { r: dr, c: dc };
}

function renderBoard() {
  const $b = document.getElementById('chess-board');
  if (!$b) return;
  $b.innerHTML = '';

  // Rank labels (left side)
  for (let dr = 0; dr < 8; dr++) {
    const { r } = logical(dr, 0);
    const $lbl = document.createElement('span');
    $lbl.className = 'rank-label';
    $lbl.style.gridRow = dr + 1;
    $lbl.textContent = 8 - r;
    $b.appendChild($lbl);
  }

  // Squares
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      const { r, c } = logical(dr, dc);
      const light = (r + c) % 2 === 0;
      const $sq = document.createElement('div');
      $sq.className = `sq ${light ? 'sq--l' : 'sq--d'}`;
      $sq.dataset.r = r;
      $sq.dataset.c = c;
      $sq.style.gridColumn = dc + 2; // +2 because col 1 = rank labels
      $sq.style.gridRow    = dr + 1;

      // File label on bottom row
      if (dr === 7) {
        const $fl = document.createElement('span');
        $fl.className = 'file-label';
        $fl.textContent = FILES[c];
        $sq.appendChild($fl);
      }

      $sq.addEventListener('click', onSqClick);
      $sq.addEventListener('dragover', onDragOver);
      $sq.addEventListener('drop', onDrop);
      $b.appendChild($sq);
    }
  }

  renderPieces();
  renderHighlights();
}

function renderPieces() {
  document.querySelectorAll('.piece').forEach(el => el.remove());
  const { board } = gs.chess;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const $sq = sqEl(r, c);
      if (!$sq) continue;
      const $p = document.createElement('div');
      $p.className = `piece piece--${p.color}`;
      $p.textContent = GLYPH[p.color + p.type];
      $p.draggable = true;
      $p.dataset.r = r;
      $p.dataset.c = c;
      $p.addEventListener('dragstart', onDragStart);
      $p.addEventListener('click', e => { e.stopPropagation(); onSqClick.call($sq, e); });
      $sq.appendChild($p);
    }
  }
}

function sqEl(r, c) {
  return document.querySelector(`#chess-board [data-r="${r}"][data-c="${c}"]`);
}

function renderHighlights() {
  // Clear
  document.querySelectorAll(
    '.sq--selected, .sq--valid, .sq--capture, .sq--check, .sq--last'
  ).forEach(el => el.classList.remove('sq--selected','sq--valid','sq--capture','sq--check','sq--last'));

  // Last move
  if (gs.lastMove) {
    sqEl(gs.lastMove.fromR, gs.lastMove.fromC)?.classList.add('sq--last');
    sqEl(gs.lastMove.toR,   gs.lastMove.toC  )?.classList.add('sq--last');
  }

  // Check on king
  if (inCheck(gs.chess.board, gs.chess.turn)) {
    const k = findKing(gs.chess.board, gs.chess.turn);
    if (k) sqEl(k.r, k.c)?.classList.add('sq--check');
  }

  // Selected piece & its moves
  if (selectedSq) {
    sqEl(selectedSq.r, selectedSq.c)?.classList.add('sq--selected');
  }
  for (const m of selectedMoves) {
    const el = sqEl(m.toR, m.toC);
    if (!el) continue;
    const isCapture = !!gs.chess.board[m.toR][m.toC] || m.special === 'en-passant';
    el.classList.add(isCapture ? 'sq--capture' : 'sq--valid');
  }
}

function renderTimers() {
  const { timers, chess } = gs;
  const wEl = document.getElementById('timer-w');
  const bEl = document.getElementById('timer-b');
  if (wEl) {
    wEl.textContent = fmtTime(timers.w);
    wEl.closest('.player-card')?.classList.toggle('player-card--active', chess.turn === W && gs.active);
  }
  if (bEl) {
    bEl.textContent = fmtTime(timers.b);
    bEl.closest('.player-card')?.classList.toggle('player-card--active', chess.turn === B && gs.active);
  }
}

function renderCaptured() {
  const groups = { w: {}, b: {} };
  for (const type of gs.captured.w) groups.w[type] = (groups.w[type] || 0) + 1;
  for (const type of gs.captured.b) groups.b[type] = (groups.b[type] || 0) + 1;

  // Material advantage delta
  const advW = gs.captured.b.reduce((s, t) => s + PIECE_VAL[t], 0);
  const advB = gs.captured.w.reduce((s, t) => s + PIECE_VAL[t], 0);

  const render = (color, el, advEl) => {
    if (!el) return;
    el.innerHTML = '';
    const captured = color === W ? gs.captured.b : gs.captured.w; // white captured black's pieces
    const order = ['Q','R','B','N','P'];
    for (const type of order) {
      const count = (color === W ? groups.b : groups.w)[type] || 0;
      for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.textContent = GLYPH[opp(color) + type];
        el.appendChild(span);
      }
    }
    const adv = color === W ? advW - advB : advB - advW;
    if (advEl) advEl.textContent = adv > 0 ? `+${adv}` : '';
  };

  render(W, document.getElementById('captured-w'), document.getElementById('adv-w'));
  render(B, document.getElementById('captured-b'), document.getElementById('adv-b'));
}

function renderMoveHistory() {
  const el = document.getElementById('move-history');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < gs.history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'mh-row';
    const num = document.createElement('span');
    num.className = 'mh-num';
    num.textContent = Math.floor(i/2) + 1 + '.';
    const wm = document.createElement('span');
    wm.className = `mh-move ${Math.floor(i/2)*2 === gs.history.length - 1 ? 'mh-move--last' : ''}`;
    wm.textContent = gs.history[i] || '';
    const bm = document.createElement('span');
    bm.className = `mh-move ${i+1 === gs.history.length - 1 ? 'mh-move--last' : ''}`;
    bm.textContent = gs.history[i+1] || '';
    row.appendChild(num); row.appendChild(wm); row.appendChild(bm);
    el.appendChild(row);
  }
  el.scrollTop = el.scrollHeight;
}

function setStatus(msg, type = '') {
  const el = document.getElementById('chess-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `chess-status${type ? ' chess-status--' + type : ''}`;
}

function turnStatus() {
  const { turn } = gs.chess;
  const who = turn === W ? 'White' : 'Black';
  const check = inCheck(gs.chess.board, turn);
  if (gs.mode === 'pvc' && turn !== gs.humanColor) return 'Computer is thinking…';
  return check ? `${who} is in check! Make a move.` : `${who}'s turn`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. INTERACTION — CLICK + DRAG
// ─────────────────────────────────────────────────────────────────────────────

function canInteract() {
  if (!gs.active) return false;
  if (pendingPromo) return false;
  if (gs.mode === 'pvc' && gs.chess.turn !== gs.humanColor) return false;
  return true;
}

function onSqClick(e) {
  if (!canInteract()) return;
  const r = parseInt(this.dataset.r || e.currentTarget?.dataset.r);
  const c = parseInt(this.dataset.c || e.currentTarget?.dataset.c);
  if (isNaN(r) || isNaN(c)) return;
  handleSelect(r, c);
}

function handleSelect(r, c) {
  const p = gs.chess.board[r][c];

  // If a valid destination is clicked — execute move
  if (selectedSq) {
    const move = selectedMoves.find(m => m.toR === r && m.toC === c);
    if (move) { doMoveOrPromote(move); return; }
  }

  // Clicking own piece — select it
  if (p && p.color === gs.chess.turn) {
    selectedSq = { r, c };
    selectedMoves = legalMovesForPiece(gs.chess.board, gs.chess, r, c);
    renderHighlights();
    return;
  }

  // Deselect
  selectedSq = null;
  selectedMoves = [];
  renderHighlights();
}

// ── Drag & drop ──────────────────────────────────────────────────────────────
let dragFrom = null;

function onDragStart(e) {
  if (!canInteract()) { e.preventDefault(); return; }
  dragFrom = { r: parseInt(this.dataset.r), c: parseInt(this.dataset.c) };
  const p = gs.chess.board[dragFrom.r][dragFrom.c];
  if (!p || p.color !== gs.chess.turn) { e.preventDefault(); return; }
  selectedSq = dragFrom;
  selectedMoves = legalMovesForPiece(gs.chess.board, gs.chess, dragFrom.r, dragFrom.c);
  renderHighlights();
  this.closest('.sq')?.classList.add('sq--drag');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text', `${dragFrom.r},${dragFrom.c}`);
}

function onDragOver(e) {
  if (!dragFrom) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e) {
  e.preventDefault();
  if (!dragFrom || !canInteract()) return;
  const toR = parseInt(this.dataset.r);
  const toC = parseInt(this.dataset.c);
  document.querySelectorAll('.sq--drag').forEach(el => el.classList.remove('sq--drag'));
  const move = selectedMoves.find(m => m.toR === toR && m.toC === toC);
  if (move) doMoveOrPromote(move);
  else { selectedSq = null; selectedMoves = []; renderHighlights(); }
  dragFrom = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. MOVE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

function doMoveOrPromote(move) {
  if (move.special === 'promote' && !move.promoType) {
    pendingPromo = move;
    showPromotionUI(gs.chess.turn);
    return;
  }
  executeMove(move);
}

function executeMove(move) {
  const { chess } = gs;
  const allLegal = legalMoves(chess.board, chess, chess.turn);
  const notation = toAlg(chess.board, move, allLegal);

  // Captured piece
  let capturedType = null;
  if (move.special === 'en-passant') {
    capturedType = 'P';
  } else if (chess.board[move.toR][move.toC]) {
    capturedType = chess.board[move.toR][move.toC].type;
  }

  const doApply = () => {
    const { board: nb, chess: ns } = applyMove(chess.board, chess, move);
    if (capturedType) gs.captured[chess.turn].push(capturedType);

    chess.board    = nb;
    chess.turn     = ns.turn;
    chess.castling = ns.castling;
    chess.enPassant = ns.enPassant;
    chess.halfmove = ns.halfmove;

    gs.history.push(notation);
    gs.lastMove = { fromR: move.fromR, fromC: move.fromC, toR: move.toR, toC: move.toC };
    selectedSq = null;
    selectedMoves = [];

    renderBoard();
    renderCaptured();
    renderMoveHistory();
    renderTimers();
    saveGame();

    // Game-over check
    const nextMoves = legalMoves(chess.board, chess, chess.turn);
    if (!nextMoves.length) {
      if (inCheck(chess.board, chess.turn)) {
        endGame('checkmate', opp(chess.turn));
      } else {
        endGame('stalemate');
      }
      return;
    }
    if (chess.halfmove >= 100) { endGame('50move'); return; }

    setStatus(turnStatus());

    // AI turn
    if (gs.mode === 'pvc' && chess.turn !== gs.humanColor) {
      scheduleAI();
    }
  };

  // Animate capture (if any)
  if (capturedType) {
    const capR = move.special === 'en-passant'
      ? (chess.turn === W ? move.toR + 1 : move.toR - 1) : move.toR;
    const capC = move.toC;
    const $sq = sqEl(capR, capC);
    const $piece = $sq?.querySelector('.piece');
    if ($piece) {
      $piece.classList.add('piece--capture-anim');
      $piece.addEventListener('animationend', doApply, { once: true });
      return;
    }
  }
  doApply();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. PROMOTION DIALOG
// ─────────────────────────────────────────────────────────────────────────────

function showPromotionUI(color) {
  const el = document.getElementById('promotion-picker');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = ['Q','R','B','N'].map(t =>
    `<button class="promo-btn" data-type="${t}">${GLYPH[color+t]}<span>${t==='Q'?'Queen':t==='R'?'Rook':t==='B'?'Bishop':'Knight'}</span></button>`
  ).join('');
  el.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      el.hidden = true;
      const move = { ...pendingPromo, promoType: type };
      pendingPromo = null;
      executeMove(move);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. AI SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────

function scheduleAI() {
  if (aiRunning) return;
  aiRunning = true;
  setStatus('Computer is thinking…', 'thinking');
  // Use a short delay so the UI updates before the blocking AI call
  setTimeout(() => {
    const move = getAIMove(gs.chess.board, gs.chess, gs.aiLevel);
    aiRunning = false;
    if (move) {
      executeMove(move);
    } else {
      // Shouldn't happen — handled in executeMove post-loop, but just in case
      const moves = legalMoves(gs.chess.board, gs.chess, gs.chess.turn);
      if (!moves.length) {
        if (inCheck(gs.chess.board, gs.chess.turn)) endGame('checkmate', opp(gs.chess.turn));
        else endGame('stalemate');
      }
    }
  }, 80);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. GAME LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

function startGame(mode, aiLevel, savedData) {
  stopTimer();
  aiRunning = false;
  pendingPromo = null;
  selectedSq = null;
  selectedMoves = [];
  boardFlipped = false;

  if (savedData) {
    gs = {
      active: true,
      mode:       savedData.mode,
      aiLevel:    savedData.aiLevel,
      humanColor: savedData.humanColor,
      chess:      cloneChess(savedData.chess),
      timers:     { ...savedData.timers },
      history:    [...savedData.history],
      captured:   { w: [...savedData.captured.w], b: [...savedData.captured.b] },
      lastMove:   savedData.lastMove ? { ...savedData.lastMove } : null,
    };
  } else {
    gs = {
      active: true,
      mode,
      aiLevel: aiLevel || 1,
      humanColor: W,
      chess: {
        board: makeBoard(),
        turn: W,
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        enPassant: null,
        halfmove: 0,
      },
      timers: { w: 0, b: 0 },
      history: [],
      captured: { w: [], b: [] },
      lastMove: null,
    };
    if (!savedData) clearSave();
  }

  // Update player label
  const bLabel = document.getElementById('player-b-label');
  const wLabel = document.getElementById('player-w-label');
  if (bLabel) bLabel.textContent = gs.mode === 'pvc' ? (gs.humanColor === B ? '♟ You' : `🤖 CPU (Lvl ${gs.aiLevel})`) : '♟ Black';
  if (wLabel) wLabel.textContent = gs.mode === 'pvc' ? (gs.humanColor === W ? '♙ You' : `🤖 CPU (Lvl ${gs.aiLevel})`) : '♙ White';

  hideAllOverlays();
  renderBoard();
  renderCaptured();
  renderMoveHistory();
  renderTimers();
  setStatus(turnStatus());
  startTimer();

  if (gs.mode === 'pvc' && gs.chess.turn !== gs.humanColor) scheduleAI();
}

function endGame(reason, winner) {
  gs.active = false;
  stopTimer();
  clearSave();
  selectedSq = null;
  selectedMoves = [];

  let title = '', sub = '';
  let result = 'draw';

  if (reason === 'checkmate') {
    title = '♟ Checkmate!';
    sub = `${winner === W ? 'White' : 'Black'} wins!`;
    if (gs.mode === 'pvc') result = winner === gs.humanColor ? 'win' : 'loss';
    else result = 'win';
  } else if (reason === 'stalemate') {
    title = '🤝 Stalemate'; sub = 'No legal moves — draw.'; result = 'draw';
  } else if (reason === '50move') {
    title = '🤝 Draw'; sub = '50-move rule.'; result = 'draw';
  } else if (reason === 'resign') {
    title = '🏳 Resign'; sub = `${winner === W ? 'White' : 'Black'} wins by resignation.`;
    result = gs.mode === 'pvc' ? (winner === gs.humanColor ? 'win' : 'loss') : 'loss';
  } else if (reason === 'draw-agree') {
    title = '🤝 Draw agreed'; sub = 'Both players agreed to a draw.'; result = 'draw';
  }

  recordResult(result);
  renderBoard(); // clear highlights
  setStatus(sub, 'over');
  showGameOverOverlay(title, sub, result);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. OVERLAYS & MODALS
// ─────────────────────────────────────────────────────────────────────────────

function hideAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
}

function showOverlay(id) {
  hideAllOverlays();
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function showStartScreen() {
  gs.active = false;
  stopTimer();
  // Check for saved game
  const save = loadSave();
  if (save) {
    const modesLabel = save.mode === 'pvc' ? `vs Computer (Level ${save.aiLevel})` : 'vs Player';
    const dt = new Date(save.savedAt).toLocaleString();
    const el = document.getElementById('resume-info');
    if (el) el.textContent = `${modesLabel} · ${save.history.length} moves · ${dt}`;
    showOverlay('overlay-resume');
  } else {
    showOverlay('overlay-mode');
  }
}

function showGameOverOverlay(title, sub, result) {
  document.getElementById('go-title').textContent = title;
  document.getElementById('go-sub').textContent = sub;
  renderScoreTable();
  showOverlay('overlay-gameover');
}

function renderScoreTable() {
  const sc = getScores();
  const el = document.getElementById('go-scores');
  if (!el) return;

  if (gs.mode === 'pvc') {
    const rows = [1,2,3].map(lvl => {
      const s = sc.vsComputer[lvl];
      return `<tr><td>Level ${lvl}</td><td>${s.wins+s.losses+s.draws}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td></tr>`;
    }).join('');
    el.innerHTML = `<p class="score-heading">vs Computer</p>
      <table class="score-tbl"><thead><tr><th>Level</th><th>Games</th><th>W</th><th>L</th><th>D</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    const s = sc.vsPlayer;
    el.innerHTML = `<p class="score-heading">vs Player (overall)</p>
      <table class="score-tbl"><thead><tr><th>Games</th><th>W</th><th>L</th><th>D</th></tr></thead>
      <tbody><tr><td>${s.wins+s.losses+s.draws}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td></tr></tbody></table>`;
  }
}

function showFullScoreModal() {
  const sc = getScores();
  const el = document.getElementById('modal-scores-body');
  if (!el) return;
  const vcRows = [1,2,3].map(lvl => {
    const s = sc.vsComputer[lvl];
    const t = s.wins+s.losses+s.draws;
    return `<tr><td>Level ${lvl}</td><td>${t}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td></tr>`;
  }).join('');
  const vp = sc.vsPlayer; const vpt = vp.wins+vp.losses+vp.draws;
  el.innerHTML = `
    <h3>vs Computer</h3>
    <table class="score-tbl">
      <thead><tr><th>Level</th><th>Games</th><th>Wins</th><th>Losses</th><th>Draws</th></tr></thead>
      <tbody>${vcRows}</tbody>
    </table>
    <h3>vs Player</h3>
    <table class="score-tbl">
      <thead><tr><th>Games</th><th>Wins</th><th>Losses</th><th>Draws</th></tr></thead>
      <tbody><tr><td>${vpt}</td><td>${vp.wins}</td><td>${vp.losses}</td><td>${vp.draws}</td></tr></tbody>
    </table>`;
  document.getElementById('modal-scores').hidden = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. BOARD FLIP
// ─────────────────────────────────────────────────────────────────────────────

function flipBoard() {
  boardFlipped = !boardFlipped;
  renderBoard();
  renderCaptured();
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. WIRING — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

const HELP_HTML = `
<h2>♟ Chess Rules</h2>
<section><h3>Objective</h3><p>Checkmate your opponent's King — threaten it with no way to escape.</p></section>
<section><h3>Piece Movements</h3><ul>
  <li><strong>♙ Pawn:</strong> Moves forward 1 square (2 on first move). Captures diagonally.</li>
  <li><strong>♘ Knight:</strong> L-shape (2+1 squares). Only piece that can jump.</li>
  <li><strong>♗ Bishop:</strong> Any distance diagonally. Stays on its starting color.</li>
  <li><strong>♖ Rook:</strong> Any distance straight (ranks/files).</li>
  <li><strong>♕ Queen:</strong> Any distance in any direction (Bishop + Rook combined).</li>
  <li><strong>♔ King:</strong> One square in any direction. Must never move into check.</li>
</ul></section>
<section><h3>Special Rules</h3>
  <h4>Castling</h4><p>King moves 2 squares toward a Rook; rook jumps to the other side.
  Conditions: neither piece has moved, no pieces between them, king not in/through check.</p>
  <h4>En Passant</h4><p>If a pawn advances 2 squares and lands beside an enemy pawn, the
  enemy may capture it "in passing" — but only on the very next move.</p>
  <h4>Pawn Promotion</h4><p>Pawn reaching the opposite end may promote to Queen, Rook, Bishop, or Knight.</p>
</section>
<section><h3>Winning & Drawing</h3><ul>
  <li><strong>Checkmate:</strong> King in check with no escape. Game over!</li>
  <li><strong>Stalemate:</strong> No legal moves but not in check → Draw.</li>
  <li><strong>50-Move Rule:</strong> 50 moves without pawn move or capture → Draw.</li>
  <li><strong>Resignation:</strong> Either player may resign.</li>
</ul></section>
<section><h3>Tips</h3><ul>
  <li>Control the center with pawns and pieces in the opening.</li>
  <li>Develop knights and bishops before moving the queen.</li>
  <li>Castle early to protect your king.</li>
  <li>Avoid leaving pieces undefended.</li>
</ul></section>`;

document.addEventListener('DOMContentLoaded', () => {

  // ── Overlay: Resume prompt ──────────────────────────────────────────────
  document.getElementById('btn-resume-yes')?.addEventListener('click', () => {
    const save = loadSave();
    if (save) startGame(null, null, save);
    else showOverlay('overlay-mode');
  });
  document.getElementById('btn-resume-no')?.addEventListener('click', () => {
    clearSave();
    showOverlay('overlay-mode');
  });

  // ── Overlay: Mode select ────────────────────────────────────────────────
  document.getElementById('btn-mode-pvp')?.addEventListener('click', () => {
    startGame('pvp', null);
  });
  document.getElementById('btn-mode-pvc')?.addEventListener('click', () => {
    showOverlay('overlay-difficulty');
  });

  // ── Overlay: Difficulty ─────────────────────────────────────────────────
  [1, 2, 3].forEach(lvl => {
    document.getElementById(`btn-lvl-${lvl}`)?.addEventListener('click', () => {
      startGame('pvc', lvl);
    });
  });
  document.getElementById('btn-diff-back')?.addEventListener('click', () => {
    showOverlay('overlay-mode');
  });

  // ── Overlay: Game over ──────────────────────────────────────────────────
  document.getElementById('btn-go-new')?.addEventListener('click', () => showOverlay('overlay-mode'));
  document.getElementById('btn-go-rematch')?.addEventListener('click', () => {
    startGame(gs.mode, gs.aiLevel);
  });

  // ── Controls ────────────────────────────────────────────────────────────
  document.getElementById('btn-flip')?.addEventListener('click', flipBoard);

  document.getElementById('btn-resign')?.addEventListener('click', () => {
    if (!gs.active) return;
    if (!confirm('Resign this game?')) return;
    endGame('resign', opp(gs.chess.turn));
  });

  document.getElementById('btn-draw')?.addEventListener('click', () => {
    if (!gs.active) return;
    if (gs.mode === 'pvc') { alert('The computer never agrees to a draw 😄'); return; }
    if (confirm('Offer draw? Both players agree?')) endGame('draw-agree');
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    if (gs.active && !confirm('Abandon current game and start over?')) return;
    showOverlay('overlay-mode');
  });

  // ── Header buttons ───────────────────────────────────────────────────────
  document.getElementById('btn-scores')?.addEventListener('click', showFullScoreModal);
  document.getElementById('btn-help')?.addEventListener('click', () => {
    document.getElementById('help-content').innerHTML = HELP_HTML;
    document.getElementById('modal-help').hidden = false;
  });

  // ── Modals close ────────────────────────────────────────────────────────
  document.getElementById('btn-close-scores')?.addEventListener('click', () => {
    document.getElementById('modal-scores').hidden = true;
  });
  document.getElementById('btn-close-help')?.addEventListener('click', () => {
    document.getElementById('modal-help').hidden = true;
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
  });

  // ── Start ────────────────────────────────────────────────────────────────
  showStartScreen();
});
