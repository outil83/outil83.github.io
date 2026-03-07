/**
 * app.js — GConsole Portal Shell
 * Initializes core managers and populates the UI.
 */

import StorageManager from './core/StorageManager.js';
import InputManager, { INTENTS } from './core/InputManager.js';
import ProfileManager from './core/ProfileManager.js';
import AdManager from './core/AdManager.js';

// ---- Game Registry ----
const GAMES = [
  {
    id: 'pacman',
    title: 'Pacman Arena',
    description: 'Open-arena chase. Eat eggs to weaken ghosts — or get eaten first.',
    icon: '🟡',
    path: 'games/pacman/index.html',
    color: '#f5c518',
  },
  {
    id: 'chess',
    title: 'Chess',
    description: 'Two-player strategy board game',
    icon: '♟️',
    path: 'games/chess/index.html',
    color: '#8b4513',
  },
  {
    id: 'roadrunner',
    title: 'Road Runner',
    description: 'Endless runner action game',
    icon: '🏃',
    path: 'games/roadrunner/index.html',
    color: '#e94560',
  },
];

// ---- Google Forms Config ----
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform';
// Replace YOUR_FORM_ID and entry field IDs with actual values

// ---- DOM References ----
let $gameGrid,
  $profileBtn,
  $leaderboardBtn,
  $syncBtn,
  $profileModal,
  $leaderboardModal,
  $createProfileModal,
  $bannerAds,
  $sidebarAds,
  $toast,
  $activeProfileName;

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
  cacheDOMReferences();
  InputManager.init(document.body);
  AdManager.init({
    bannerContainer: $bannerAds,
    sidebarContainer: $sidebarAds,
  });

  // Check for first-time visitor
  if (!ProfileManager.hasProfiles()) {
    showCreateProfileModal();
  } else {
    // Ensure active profile is set
    if (!ProfileManager.getActive()) {
      const profiles = ProfileManager.getAll();
      ProfileManager.setActive(profiles[0].id);
    }
  }

  renderUI();
  bindEvents();
  bindInputManager();

  console.log('[GConsole] Portal initialized');
});

function cacheDOMReferences() {
  $gameGrid = document.getElementById('game-grid');
  $profileBtn = document.getElementById('btn-profile');
  $leaderboardBtn = document.getElementById('btn-leaderboard');
  $syncBtn = document.getElementById('btn-sync');
  $profileModal = document.getElementById('modal-profile');
  $leaderboardModal = document.getElementById('modal-leaderboard');
  $createProfileModal = document.getElementById('modal-create-profile');
  $bannerAds = document.getElementById('banner-ads');
  $sidebarAds = document.getElementById('sidebar-ads');
  $toast = document.getElementById('toast');
  $activeProfileName = document.getElementById('active-profile-name');
}

// ---- Rendering ----
function renderUI() {
  renderActiveProfile();
  renderGameGrid();
}

function renderActiveProfile() {
  const profile = ProfileManager.getActive();
  if (profile && $activeProfileName) {
    $activeProfileName.textContent = `${profile.avatar} ${profile.name}`;
  } else if ($activeProfileName) {
    $activeProfileName.textContent = 'No Profile';
  }
}

function renderGameGrid() {
  if (!$gameGrid) return;
  const activeProfile = ProfileManager.getActive();
  const playerId = activeProfile ? activeProfile.id : null;

  $gameGrid.innerHTML = GAMES.map(
    (game) => {
      const bestScore = playerId
        ? StorageManager.getPlayerBest(game.id, playerId)
        : 0;

      return `
      <div class="game-card" tabindex="0" data-game-id="${game.id}" data-game-path="${game.path}" role="button" aria-label="Play ${game.title}">
        <div class="game-card__image" style="background-color: ${game.color}20; color: ${game.color};">
          ${game.icon}
        </div>
        <div class="game-card__body">
          <h3 class="game-card__title">${game.title}</h3>
          <p class="game-card__meta">${game.description}</p>
          ${bestScore > 0 ? `<span class="game-card__score">Best: ${bestScore.toLocaleString()}</span>` : ''}
        </div>
      </div>
    `;
    }
  ).join('');
}

// ---- Event Binding ----
function bindEvents() {
  // Game card clicks
  $gameGrid?.addEventListener('click', (e) => {
    const card = e.target.closest('.game-card');
    if (card) launchGame(card.dataset.gamePath);
  });

  // Profile button
  $profileBtn?.addEventListener('click', () => showProfileModal());

  // Leaderboard button
  $leaderboardBtn?.addEventListener('click', () => showLeaderboardModal());

  // Sync button
  $syncBtn?.addEventListener('click', () => syncToGoogleForms());

  // Footer sync link
  document.getElementById('btn-sync-footer')?.addEventListener('click', (e) => {
    e.preventDefault();
    syncToGoogleForms();
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // Close buttons
  document.querySelectorAll('.modal__close').forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });

  // Create profile form
  document.getElementById('form-create-profile')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('input-profile-name');
    const name = nameInput?.value.trim();
    if (!name) return;
    const profile = ProfileManager.create(name);
    ProfileManager.setActive(profile.id);
    nameInput.value = '';
    closeAllModals();
    renderUI();
    showToast(`Welcome, ${profile.name}!`);
  });
}

function bindInputManager() {
  // Navigate game cards with directional intents
  let focusedIndex = -1;

  InputManager.on(INTENTS.RIGHT, () => moveFocus(1));
  InputManager.on(INTENTS.LEFT, () => moveFocus(-1));
  InputManager.on(INTENTS.DOWN, () => moveFocus(getColumnsCount()));
  InputManager.on(INTENTS.UP, () => moveFocus(-getColumnsCount()));

  InputManager.on(INTENTS.SELECT, () => {
    const cards = $gameGrid?.querySelectorAll('.game-card');
    if (cards && focusedIndex >= 0 && focusedIndex < cards.length) {
      const card = cards[focusedIndex];
      launchGame(card.dataset.gamePath);
    }
  });

  InputManager.on(INTENTS.BACK, () => {
    closeAllModals();
  });

  function moveFocus(delta) {
    const cards = $gameGrid?.querySelectorAll('.game-card');
    if (!cards || cards.length === 0) return;
    focusedIndex = Math.max(0, Math.min(cards.length - 1, focusedIndex + delta));
    cards[focusedIndex].focus();
  }

  function getColumnsCount() {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 1024) return 2;
    if (width < 1440) return 3;
    return 4;
  }
}

// ---- Game Launch ----
function launchGame(path) {
  const profile = ProfileManager.getActive();
  if (!profile) {
    showCreateProfileModal();
    return;
  }
  StorageManager.logAudit(profile.id, 'game_start', { gameId: path });
  window.location.href = path;
}

// ---- Modals ----
function showProfileModal() {
  closeAllModals();
  const list = $profileModal?.querySelector('.profile-list');
  if (list) {
    const profiles = ProfileManager.getAll();
    const activeId = ProfileManager.getActive()?.id;
    list.innerHTML = profiles
      .map(
        (p) => `
      <li class="profile-item ${p.id === activeId ? 'active' : ''}" data-profile-id="${p.id}">
        <div class="profile-item__avatar">${p.avatar}</div>
        <span class="profile-item__name">${p.name}</span>
      </li>
    `
      )
      .join('');

    list.innerHTML += `
      <li class="profile-item" id="btn-new-profile" style="justify-content: center; color: var(--color-primary);">
        + New Profile
      </li>
    `;

    // Profile selection
    list.querySelectorAll('.profile-item[data-profile-id]').forEach((item) => {
      item.addEventListener('click', () => {
        ProfileManager.setActive(item.dataset.profileId);
        closeAllModals();
        renderUI();
      });
    });

    // New profile button
    document.getElementById('btn-new-profile')?.addEventListener('click', () => {
      closeAllModals();
      showCreateProfileModal();
    });
  }

  $profileModal?.closest('.modal-overlay')?.classList.add('active');
}

function showLeaderboardModal() {
  closeAllModals();
  const body = $leaderboardModal?.querySelector('.modal__body');
  if (body) {
    let html = '';
    GAMES.forEach((game) => {
      const lb = ProfileManager.getLeaderboard(game.id, 5);
      html += `<h4 style="margin: 1rem 0 0.5rem; color: var(--color-accent);">${game.icon} ${game.title}</h4>`;
      if (lb.length === 0) {
        html += '<p style="color: var(--color-text-muted); font-size: 0.85rem;">No scores yet</p>';
      } else {
        html += `<table class="leaderboard-table">
          <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
          <tbody>
            ${lb
              .map(
                (entry) => `
              <tr>
                <td>${entry.rank}</td>
                <td>${entry.playerName}</td>
                <td>${entry.score.toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>`;
      }
    });
    body.innerHTML = html;
  }

  $leaderboardModal?.closest('.modal-overlay')?.classList.add('active');
}

function showCreateProfileModal() {
  closeAllModals();
  $createProfileModal?.closest('.modal-overlay')?.classList.add('active');
  document.getElementById('input-profile-name')?.focus();
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.classList.remove('active');
  });
}

// ---- Google Forms Sync ----
function syncToGoogleForms() {
  const profile = ProfileManager.getActive();
  if (!profile) {
    showToast('Please create a profile first');
    return;
  }

  const scores = StorageManager.get('scores', []).filter(
    (s) => s.playerId === profile.id
  );
  const audit = StorageManager.get('audit', []).filter(
    (a) => a.playerId === profile.id
  );

  // Build pre-filled Google Form URL
  // Replace entry.XXXXXXX with actual field IDs from your Google Form
  const params = new URLSearchParams({
    'entry.1000000': profile.name,
    'entry.1000001': profile.id,
    'entry.1000002': JSON.stringify(scores),
    'entry.1000003': JSON.stringify(audit),
  });

  const url = `${GOOGLE_FORM_URL}?${params.toString()}`;
  window.open(url, '_blank');

  StorageManager.logAudit(profile.id, 'data_sync');
  showToast('Sync form opened in new tab');
}

// ---- Toast Notification ----
function showToast(message, duration = 3000) {
  if (!$toast) return;
  $toast.textContent = message;
  $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), duration);
}
