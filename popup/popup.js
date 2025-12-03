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

    // Generate AI context in background
    generateContextForSession(response.id);

    showLoading(false);
    renderSessions();
    switchTab('sessions');

    // Auto-refresh every 2 seconds to show generation progress
    startAutoRefresh();
  } catch (error) {
    showError('Failed to save session: ' + error.message);
    showLoading(false);
  }
}

let autoRefreshInterval = null;

function startAutoRefresh() {
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  // Refresh every 2 seconds while any session is generating
  autoRefreshInterval = setInterval(async () => {
    await loadSessions();
    const hasGenerating = sessions.some(s => s.generatingContext);

    if (hasGenerating) {
      renderSessions();
    } else {
      // Stop refreshing when all done
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }, 2000);

  // Stop after 60 seconds max
  setTimeout(() => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }, 60000);
}

async function generateContextForSession(sessionId) {
  try {
    console.log('generateContextForSession called for:', sessionId);
    console.log('Auto-context enabled:', settings.autoContext);

    // Check if auto-context is enabled
    if (!settings.autoContext) {
      console.log('Auto-context is disabled, skipping');
      return;
    }

    // Find the session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      console.log('Session not found:', sessionId);
      return;
    }

    console.log('Requesting context generation from background script...');

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

    console.log('Context generated successfully:', response.context);

    // DON'T update local session and save - the background script already saved everything
    // Just reload from storage to get the complete updated session with tab groups
    await loadSessions();
    renderSessions();
    console.log('Session reloaded from storage with all updates');
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

    // Click on card to view details
    card.addEventListener('click', () => {
      window.location.href = `session-detail.html?id=${sessionId}`;
    });

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

    // Click on card to view details
    card.addEventListener('click', () => {
      window.location.href = `session-detail.html?id=${sessionId}`;
    });

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

  // Context or generation status
  let contextHtml = '';
  if (session.generatingContext) {
    contextHtml = `<div class="session-context generating">⏳ ${escapeHtml(session.generationStatus || 'Generating...')}</div>`;
  } else if (session.context) {
    contextHtml = `<div class="session-context">${escapeHtml(session.context)}</div>`;
  } else {
    contextHtml = `<div class="session-context">No description available</div>`;
  }

  // Tab groups display
  let groupsHtml = '';
  if (session.tabGroups && session.tabGroups.length > 0) {
    const groupNames = session.tabGroups.map(g => g.name).join(', ');
    groupsHtml = `<div class="session-groups">🏷️ ${escapeHtml(groupNames)}</div>`;
  }

  // Window count
  const windowCount = session.windowCount || 1;
  const windowText = windowCount > 1 ? `🪟 ${windowCount} windows` : '';

  return `
    <div class="session-card" data-session-id="${session.id}">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.name)}</div>
        <div class="session-actions">
          <button class="restore-btn" title="Restore">🔄</button>
          <button class="delete-btn" title="Delete">🗑️</button>
        </div>
      </div>
      ${contextHtml}
      ${groupsHtml}
      <div class="session-meta">
        <span>📅 ${date}</span>
        <span>🕐 ${time}</span>
        <span>📑 ${session.tabCount} tabs</span>
        ${windowText ? `<span>${windowText}</span>` : ''}
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

    // Show info if some tabs were skipped
    if (response.skipped > 0) {
      showError(`Session restored! (${response.skipped} protected browser tab${response.skipped > 1 ? 's' : ''} skipped)`);
      setTimeout(hideError, 3000);
    }
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
