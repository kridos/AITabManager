// Options page script for AI Tab Session Manager

document.addEventListener('DOMContentLoaded', init);

let settings = {};

async function init() {
  await loadSettings();
  populateForm();
  setupEventListeners();
}

async function loadSettings() {
  const result = await chrome.storage.local.get(['settings']);
  settings = result.settings || {
    aiProvider: 'anthropic',
    apiKey: '',
    model: 'claude-3-haiku-20240307',
    searchSensitivity: 7,
    autoContext: true
  };
}

function populateForm() {
  document.getElementById('aiProvider').value = settings.aiProvider || 'anthropic';
  document.getElementById('apiKey').value = settings.apiKey || '';
  document.getElementById('model').value = settings.model || 'claude-3-haiku-20240307';
  document.getElementById('searchSensitivity').value = settings.searchSensitivity || 7;
  document.getElementById('autoContext').checked = settings.autoContext !== false;

  // Update model options based on provider
  updateModelOptions();
}

function setupEventListeners() {
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('exportBtn').addEventListener('click', exportSessions);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importSessions);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllSessions);

  document.getElementById('aiProvider').addEventListener('change', updateModelOptions);
}

function updateModelOptions() {
  const provider = document.getElementById('aiProvider').value;
  const modelSelect = document.getElementById('model');

  if (provider === 'anthropic') {
    modelSelect.innerHTML = `
      <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast & Cheap)</option>
      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
    `;
  } else if (provider === 'openai') {
    modelSelect.innerHTML = `
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Cheap)</option>
      <option value="gpt-4">GPT-4</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option>
    `;
  }
}

async function saveSettings() {
  const newSettings = {
    aiProvider: document.getElementById('aiProvider').value,
    apiKey: document.getElementById('apiKey').value,
    model: document.getElementById('model').value,
    searchSensitivity: parseInt(document.getElementById('searchSensitivity').value),
    autoContext: document.getElementById('autoContext').checked
  };

  await chrome.storage.local.set({ settings: newSettings });
  settings = newSettings;

  showStatus('Settings saved successfully!', 'success');
}

async function exportSessions() {
  try {
    const result = await chrome.storage.local.get(['sessions']);
    const sessions = result.sessions || [];

    const dataStr = JSON.stringify(sessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tab-sessions-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    showStatus('Sessions exported successfully!', 'success');
  } catch (error) {
    showStatus('Failed to export sessions: ' + error.message, 'error');
  }
}

async function importSessions(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importedSessions = JSON.parse(text);

    if (!Array.isArray(importedSessions)) {
      throw new Error('Invalid session data format');
    }

    const result = await chrome.storage.local.get(['sessions']);
    const existingSessions = result.sessions || [];

    // Merge sessions, avoiding duplicates
    const mergedSessions = [...existingSessions];
    importedSessions.forEach(session => {
      if (!mergedSessions.find(s => s.id === session.id)) {
        mergedSessions.push(session);
      }
    });

    await chrome.storage.local.set({ sessions: mergedSessions });
    showStatus(`Imported ${importedSessions.length} sessions successfully!`, 'success');
  } catch (error) {
    showStatus('Failed to import sessions: ' + error.message, 'error');
  }

  // Reset file input
  event.target.value = '';
}

async function clearAllSessions() {
  if (!confirm('Are you sure you want to delete ALL saved sessions? This cannot be undone.')) {
    return;
  }

  if (!confirm('This will permanently delete all your saved sessions. Are you absolutely sure?')) {
    return;
  }

  try {
    await chrome.storage.local.set({ sessions: [] });
    showStatus('All sessions cleared successfully!', 'success');
  } catch (error) {
    showStatus('Failed to clear sessions: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');

  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}
