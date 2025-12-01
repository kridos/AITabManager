// Popup script for AI Tab Session Manager

document.addEventListener('DOMContentLoaded', init);

let sessions = [];
let settings = {};

async function init() {
  // Load settings and sessions
  await loadSettings();
  await loadSessions();

  // Set up event listeners
  document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  document.getElementById('settingsBtn').addEventListener('click', openSettings);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Render sessions
  renderSessions();
}

async function loadSettings() {
  const result = await chrome.storage.local.get(['settings']);
  settings = result.settings || {};
}

async function loadSessions() {
  const result = await chrome.storage.local.get(['sessions']);
  sessions = result.sessions || [];
}

async function saveSessions() {
  await chrome.storage.local.set({ sessions });
}

async function saveSession() {
  try {
    showLoading(true);
    hideError();

    // Capture current tabs
    const response = await chrome.runtime.sendMessage({ action: 'captureSession' });

    if (response.error) {
      throw new Error(response.error);
    }

    // Add to sessions array
    sessions.unshift(response);
    await saveSessions();

    // Generate AI context in background (will be implemented later)
    generateContextForSession(response.id);

    showLoading(false);
    renderSessions();
    switchTab('sessions');
  } catch (error) {
    showError('Failed to save session: ' + error.message);
    showLoading(false);
  }
}

async function generateContextForSession(sessionId) {
  try {
    // Check if auto-context is enabled
    if (!settings.autoContext) {
      return;
    }

    // Find the session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return;
    }

    // Generate context in background
    const response = await chrome.runtime.sendMessage({
      action: 'generateContext',
      sessionId: sessionId,
      tabs: session.tabs
    });

    if (response.error) {
      console.error('Failed to generate context:', response.error);
      return;
    }

    // Update local session with context
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].context = response.context;
      await saveSessions();
      renderSessions();
    }
  } catch (error) {
    console.error('Error generating context:', error);
  }
}

async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();

  if (!query) {
    showError('Please enter a search query');
    return;
  }

  try {
    showLoading(true);
    hideError();

    // Use semantic search from background script
    const response = await chrome.runtime.sendMessage({
      action: 'searchSessions',
      query: query
    });

    if (response.error) {
      throw new Error(response.error);
    }

    renderSearchResults(response.results);
    switchTab('search');
    showLoading(false);

    // Show search method used
    if (response.method === 'semantic') {
      console.log('Used semantic search with embeddings');
    } else {
      console.log('Used text-based search (configure OpenAI API for semantic search)');
    }
  } catch (error) {
    showError('Search failed: ' + error.message);
    showLoading(false);
  }
}

function renderSessions() {
  const container = document.getElementById('sessionsList');

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No saved sessions yet. Save your first session!</p>';
    return;
  }

  container.innerHTML = sessions.map(session => createSessionCard(session)).join('');

  // Add event listeners to session cards
  container.querySelectorAll('.session-card').forEach(card => {
    const sessionId = card.dataset.sessionId;

    card.querySelector('.restore-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      restoreSession(sessionId);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(sessionId);
    });
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('searchResults');

  if (results.length === 0) {
    container.innerHTML = '<p class="empty-state">No sessions found matching your query</p>';
    return;
  }

  container.innerHTML = results.map(session => createSessionCard(session)).join('');

  // Add event listeners
  container.querySelectorAll('.session-card').forEach(card => {
    const sessionId = card.dataset.sessionId;

    card.querySelector('.restore-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      restoreSession(sessionId);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(sessionId);
    });
  });
}

function createSessionCard(session) {
  const date = new Date(session.timestamp).toLocaleDateString();
  const time = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const context = session.context || 'No description available';

  return `
    <div class="session-card" data-session-id="${session.id}">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.name)}</div>
        <div class="session-actions">
          <button class="restore-btn" title="Restore">🔄</button>
          <button class="delete-btn" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="session-context">${escapeHtml(context)}</div>
      <div class="session-meta">
        <span>📅 ${date}</span>
        <span>🕐 ${time}</span>
        <span>📑 ${session.tabCount} tabs</span>
      </div>
    </div>
  `;
}

async function restoreSession(sessionId) {
  try {
    showLoading(true);
    const response = await chrome.runtime.sendMessage({
      action: 'restoreSession',
      sessionId
    });

    if (response.error) {
      throw new Error(response.error);
    }

    showLoading(false);
  } catch (error) {
    showError('Failed to restore session: ' + error.message);
    showLoading(false);
  }
}

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session?')) {
    return;
  }

  sessions = sessions.filter(s => s.id !== sessionId);
  await saveSessions();
  renderSessions();
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function showError(message) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
