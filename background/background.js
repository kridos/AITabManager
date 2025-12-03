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

// Capture all tabs from all windows
async function captureCurrentSession(sessionName = '') {
  try {
    const settings = await StorageService.getSettings();
    const multiWindow = settings.multiWindow !== false; // Default to true

    let allTabs;
    let windows = [];

    if (multiWindow) {
      // Get all windows and their tabs
      const allWindows = await chrome.windows.getAll({ populate: true });
      windows = allWindows.map(window => ({
        id: window.id,
        focused: window.focused,
        type: window.type,
        tabCount: window.tabs.length
      }));

      allTabs = allWindows.flatMap((window, windowIndex) =>
        window.tabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          index: tab.index,
          windowIndex: windowIndex,
          windowId: window.id,
          active: tab.active
        }))
      );
    } else {
      // Only current window (old behavior)
      const tabs = await chrome.tabs.query({ currentWindow: true });
      allTabs = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        index: tab.index,
        windowIndex: 0
      }));
    }

    const session = {
      id: Date.now().toString(),
      name: sessionName || `Session ${new Date().toLocaleString()}`,
      tabs: allTabs,
      windows: windows,
      timestamp: Date.now(),
      tabCount: allTabs.length,
      windowCount: multiWindow ? windows.length : 1
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

    const isValidUrl = (url) => {
      const lowerUrl = url.toLowerCase();
      return !illegalPrefixes.some(prefix => lowerUrl.startsWith(prefix));
    };

    // Check if session has multiple windows
    const hasMultipleWindows = session.windows && session.windows.length > 1;
    let totalRestored = 0;
    let totalSkipped = 0;

    if (hasMultipleWindows) {
      // Restore each window separately
      for (let windowIndex = 0; windowIndex < session.windows.length; windowIndex++) {
        const windowTabs = session.tabs.filter(tab => tab.windowIndex === windowIndex);
        const validUrls = windowTabs
          .map(tab => tab.url)
          .filter(isValidUrl);

        if (validUrls.length > 0) {
          await chrome.windows.create({ url: validUrls });
          totalRestored += validUrls.length;
        }
        totalSkipped += windowTabs.length - validUrls.length;
      }
    } else {
      // Single window restore
      const validUrls = session.tabs
        .map(tab => tab.url)
        .filter(isValidUrl);

      if (validUrls.length === 0) {
        throw new Error('No valid URLs to restore (all were protected browser pages)');
      }

      await chrome.windows.create({ url: validUrls });
      totalRestored = validUrls.length;
      totalSkipped = session.tabs.length - validUrls.length;
    }

    return {
      success: true,
      restored: totalRestored,
      skipped: totalSkipped,
      windowsRestored: hasMultipleWindows ? session.windows.length : 1
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

    // Generate tab groups if enabled
    let tabGroups = [];
    if (settings.autoTabGroups) {
      try {
        console.log('Generating tab groups...');
        tabGroups = await aiService.generateTabGroups(tabs);
        console.log('Generated tab groups:', tabGroups);
      } catch (groupError) {
        console.warn('Failed to generate tab groups:', groupError);
      }
    }

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

    // Update session with context and groups
    await StorageService.updateSession(sessionId, {
      context,
      tabGroups: tabGroups.length > 0 ? tabGroups : undefined
    });
    console.log('Session updated with context and groups');

    return {
      context,
      tabGroups,
      hasEmbedding: embedding !== null
    };
  } catch (error) {
    console.error('Error generating context:', error);
    throw error;
  }
}

// Search sessions using semantic search and AI ranking
async function searchSessionsSemantically(query) {
  try {
    const settings = await StorageService.getSettings();
    const sessions = await StorageService.getSessions();

    console.log('Search query:', query);
    console.log('Total sessions:', sessions.length);

    if (sessions.length === 0) {
      return { results: [], method: 'none' };
    }

    // Filter sessions with context descriptions
    const sessionsWithContext = sessions.filter(s => s.context);
    console.log('Sessions with context:', sessionsWithContext.length);

    let candidateSessions = sessions;
    let searchMethod = 'text';

    // If using OpenAI, try semantic search with embeddings
    if (settings.aiProvider === 'openai' && settings.apiKey && sessionsWithContext.length > 0) {
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
        candidateSessions = results
          .filter(r => r.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .map(r => r.session);

        searchMethod = 'embedding';
        console.log('Embedding search found:', candidateSessions.length, 'results');
      } catch (error) {
        console.warn('Embedding search failed, falling back:', error);
      }
    }

    // Use text search if no embedding results or not using OpenAI
    if (candidateSessions.length === 0 || searchMethod === 'text') {
      candidateSessions = sessions.filter(session => {
        const searchText = `${session.name} ${session.context || ''}`.toLowerCase();
        const matches = searchText.includes(query.toLowerCase());
        if (matches) {
          console.log('Text match found:', session.name);
        }
        return matches;
      });
      searchMethod = 'text';
      console.log('Text search found:', candidateSessions.length, 'results');
    }

    // Use AI to rank ALL sessions if text search found nothing but we have context
    // This allows semantic search even when keywords don't match!
    if (settings.aiRanking && settings.apiKey && sessionsWithContext.length > 0) {
      // If text search failed, give AI all sessions with context
      const sessionsToRank = candidateSessions.length > 0 ? candidateSessions : sessionsWithContext;

      try {
        console.log('Using AI to rank search results...');
        console.log('Ranking', sessionsToRank.length, 'sessions');
        const aiService = new AIService(settings);
        const topResults = await aiService.rankSessionsByRelevance(query, sessionsToRank);
        console.log('AI ranked results:', topResults.length);

        if (topResults.length > 0) {
          return { results: topResults, method: 'ai-ranked' };
        }
      } catch (error) {
        console.warn('AI ranking failed:', error);
      }
    }

    // If no results found after all attempts, return empty
    if (candidateSessions.length === 0) {
      console.log('No results found for query:', query);
      return { results: [], method: searchMethod };
    }

    // Return top 10 results if no AI ranking
    console.log('Returning results without AI ranking:', candidateSessions.length);
    return {
      results: candidateSessions.slice(0, 10),
      method: searchMethod
    };
  } catch (error) {
    console.error('Error searching sessions:', error);
    throw error;
  }
}
