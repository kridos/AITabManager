// Session detail page script

const CONTAINER_COLORS = ['blue', 'orange', 'green', 'purple', 'red', 'yellow', 'pink', 'turquoise'];

let sessionId = null;
let session = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get session ID from URL parameters
  const params = new URLSearchParams(window.location.search);
  sessionId = params.get('id');

  if (!sessionId) {
    window.location.href = 'popup.html';
    return;
  }

  await loadSession();
  renderSession();

  // Set up event listeners
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.getElementById('restoreBtn').addEventListener('click', restoreSession);
  document.getElementById('restoreContainersBtn').addEventListener('click', restoreWithContainers);
}

async function loadSession() {
  const sessions = await StorageService.getSessions();
  session = sessions.find(s => s.id === sessionId);

  if (!session) {
    window.location.href = 'popup.html';
  }
}

function renderSession() {
  // Set session name
  document.getElementById('sessionName').textContent = session.name;

  // Set context
  const contextEl = document.getElementById('sessionContext');
  contextEl.textContent = session.context || 'No description available';

  // Set metadata
  const date = new Date(session.timestamp).toLocaleDateString();
  const time = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('sessionDate').textContent = `📅 ${date} ${time}`;
  document.getElementById('sessionTabs').textContent = `📑 ${session.tabCount} tabs`;

  if (session.windowCount > 1) {
    document.getElementById('sessionWindows').textContent = `🪟 ${session.windowCount} windows`;
  }

  // Render tab groups if available
  if (session.tabGroups && session.tabGroups.length > 0) {
    renderTabGroups();
    document.getElementById('ungroupedTabs').classList.add('hidden');
  } else {
    renderAllTabs();
    document.getElementById('tabGroups').classList.add('hidden');
  }
}

function renderTabGroups() {
  const container = document.getElementById('tabGroups');
  container.innerHTML = '';

  session.tabGroups.forEach((group, index) => {
    const color = CONTAINER_COLORS[index % CONTAINER_COLORS.length];
    const groupEl = document.createElement('div');
    groupEl.className = `tab-group color-${color}`;

    const tabsInGroup = group.tabIndices.map(idx => session.tabs[idx - 1]).filter(t => t);

    groupEl.innerHTML = `
      <div class="group-header">
        <div class="group-color-dot"></div>
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-count">${tabsInGroup.length} tabs</div>
      </div>
      <div class="tabs-list">
        ${tabsInGroup.map(tab => createTabItem(tab)).join('')}
      </div>
    `;

    container.appendChild(groupEl);
  });
}

function renderAllTabs() {
  const container = document.querySelector('#ungroupedTabs .tabs-list');
  container.innerHTML = session.tabs.map(tab => createTabItem(tab)).join('');
}

function createTabItem(tab) {
  return `
    <div class="tab-item">
      <img class="tab-icon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ccc%22/></svg>'}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%2216%22 height=%2216%22 fill=%22%23ccc%22/></svg>'">
      <div class="tab-title">${escapeHtml(tab.title)}</div>
      <div class="tab-url">${escapeHtml(new URL(tab.url).hostname)}</div>
    </div>
  `;
}

async function restoreSession() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'restoreSession',
      sessionId: sessionId
    });

    if (response.error) {
      alert('Failed to restore session: ' + response.error);
      return;
    }

    if (response.skipped > 0) {
      alert(`Session restored!\n${response.restored} tabs restored\n${response.skipped} protected tabs skipped`);
    }
  } catch (error) {
    alert('Failed to restore session: ' + error.message);
  }
}

async function restoreWithContainers() {
  if (!session.tabGroups || session.tabGroups.length === 0) {
    alert('This session has no tab groups. Please use the regular restore button.');
    return;
  }

  try {
    // Check if contextualIdentities API is available (Firefox only)
    if (!chrome.contextualIdentities) {
      alert('Container tabs are only available in Firefox.\nPlease use the regular restore button instead.');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'restoreWithContainers',
      sessionId: sessionId
    });

    if (response.error) {
      alert('Failed to restore with containers: ' + response.error);
      return;
    }

    alert(`Session restored with colored tab groups!\n${response.containersCreated} containers created\n${response.tabsRestored} tabs restored`);
  } catch (error) {
    alert('Failed to restore with containers: ' + error.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
