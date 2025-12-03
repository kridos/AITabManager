// Background service worker for AI Tab Session Manager
// Utility scripts are loaded via manifest.json

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

    // Filter out illegal URLs that browsers don't allow extensions to open
    const illegalPrefixes = [
      'about:',
      'chrome:',
      'edge:',
      'moz-extension:',
      'chrome-extension:',
      'firefox:',
      'view-source:'
    ];

    const validUrls = session.tabs
      .map(tab => tab.url)
      .filter(url => {
        const lowerUrl = url.toLowerCase();
        return !illegalPrefixes.some(prefix => lowerUrl.startsWith(prefix));
      });

    if (validUrls.length === 0) {
      throw new Error('No valid URLs to restore (all were protected browser pages)');
    }

    // Create new window with valid tabs only
    await chrome.windows.create({ url: validUrls });

    const skipped = session.tabs.length - validUrls.length;
    return {
      success: true,
      restored: validUrls.length,
      skipped: skipped
    };
  } catch (error) {
    console.error('Error restoring session:', error);
    throw error;
  }
}

// Generate AI context for a session
async function generateContextForSession(sessionId, tabs) {
  try {
    console.log('Generating context for session:', sessionId);
    const settings = await StorageService.getSettings();

    if (!settings.apiKey) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }

    console.log('Using AI provider:', settings.aiProvider, 'Model:', settings.model);
    const aiService = new AIService(settings);

    // Generate context description
    console.log('Calling AI service to generate context...');
    const context = await aiService.generateContext(tabs);
    console.log('Generated context:', context);

    // Generate embedding for semantic search
    let embedding = null;
    try {
      if (settings.aiProvider === 'openai') {
        console.log('Generating embedding...');
        embedding = await aiService.generateEmbedding(context);
        await StorageService.saveEmbedding(sessionId, embedding);
        console.log('Embedding saved');
      }
    } catch (embeddingError) {
      console.warn('Failed to generate embedding:', embeddingError);
      // Continue without embedding
    }

    // Update session with context
    await StorageService.updateSession(sessionId, { context });
    console.log('Session updated with context');

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
