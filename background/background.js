// Background service worker for AI Tab Session Manager

// Import utility scripts
importScripts('../scripts/storage.js', '../scripts/ai-service.js');

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Tab Session Manager installed');

  // Set default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      const defaultSettings = {
        aiProvider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        searchSensitivity: 7,
        autoContext: true
      };
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureSession') {
    captureCurrentSession(request.sessionName)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }

  if (request.action === 'restoreSession') {
    restoreSession(request.sessionId)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'generateContext') {
    generateContextForSession(request.sessionId, request.tabs)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'searchSessions') {
    searchSessionsSemantically(request.query)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Capture all tabs in current window
async function captureCurrentSession(sessionName = '') {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    const tabData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      index: tab.index
    }));

    const session = {
      id: Date.now().toString(),
      name: sessionName || `Session ${new Date().toLocaleString()}`,
      tabs: tabData,
      timestamp: Date.now(),
      tabCount: tabData.length
    };

    return session;
  } catch (error) {
    console.error('Error capturing session:', error);
    throw error;
  }
}

// Restore a session
async function restoreSession(sessionId) {
  try {
    const result = await chrome.storage.local.get(['sessions']);
    const sessions = result.sessions || [];
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Create new window with all tabs
    const urls = session.tabs.map(tab => tab.url);
    await chrome.windows.create({ url: urls });

    return { success: true };
  } catch (error) {
    console.error('Error restoring session:', error);
    throw error;
  }
}

// Generate AI context for a session
async function generateContextForSession(sessionId, tabs) {
  try {
    const settings = await StorageService.getSettings();
    const aiService = new AIService(settings);

    // Generate context description
    const context = await aiService.generateContext(tabs);

    // Generate embedding for semantic search
    let embedding = null;
    try {
      if (settings.aiProvider === 'openai') {
        embedding = await aiService.generateEmbedding(context);
        await StorageService.saveEmbedding(sessionId, embedding);
      }
    } catch (embeddingError) {
      console.warn('Failed to generate embedding:', embeddingError);
      // Continue without embedding
    }

    // Update session with context
    await StorageService.updateSession(sessionId, { context });

    return { context, hasEmbedding: embedding !== null };
  } catch (error) {
    console.error('Error generating context:', error);
    throw error;
  }
}

// Search sessions using semantic search
async function searchSessionsSemantically(query) {
  try {
    const settings = await StorageService.getSettings();
    const sessions = await StorageService.getSessions();

    // If using OpenAI, try semantic search with embeddings
    if (settings.aiProvider === 'openai' && settings.apiKey) {
      try {
        const aiService = new AIService(settings);
        const queryEmbedding = await aiService.generateEmbedding(query);
        const allEmbeddings = await StorageService.getAllEmbeddings();

        // Calculate similarities
        const results = [];
        for (const embData of allEmbeddings) {
          const session = sessions.find(s => s.id === embData.sessionId);
          if (session && embData.embedding) {
            const similarity = AIService.cosineSimilarity(queryEmbedding, embData.embedding);
            results.push({ session, similarity });
          }
        }

        // Sort by similarity and filter by threshold
        const threshold = (11 - settings.searchSensitivity) / 10; // Convert 1-10 to 1.0-0.1
        const filtered = results
          .filter(r => r.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .map(r => r.session);

        return { results: filtered, method: 'semantic' };
      } catch (error) {
        console.warn('Semantic search failed, falling back to text search:', error);
      }
    }

    // Fallback to simple text search
    const results = sessions.filter(session => {
      const searchText = `${session.name} ${session.context || ''}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    return { results, method: 'text' };
  } catch (error) {
    console.error('Error searching sessions:', error);
    throw error;
  }
}
