// AI Service for generating context descriptions using Claude

class AIService {
  constructor(settings) {
    this.settings = settings;
  }

  async generateContext(tabs) {
    if (!this.settings.apiKey) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }

    const tabList = tabs.map((tab, i) =>
      `${i + 1}. ${tab.title} (${tab.url})`
    ).join('\n');

    const prompt = `Analyze these browser tabs and create a concise summary of what the user was working on.

Tabs:
${tabList}

Return ONLY 2-4 short bullet points (use • as bullets). Each bullet should be under 10 words. Focus on:
- Main topics or projects
- Key activities or tasks
- Important tools or platforms being used

Example format:
• Working on CSE 333 homework assignment
• Browsing documentation for React hooks
• Managing email and calendar events`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: this.settings.model,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  // Use Claude to rank sessions by relevance to search query
  async rankSessionsByRelevance(query, sessions) {
    if (sessions.length === 0) {
      return [];
    }

    // Prepare session list for AI
    const sessionList = sessions.map((session, i) =>
      `${i + 1}. ${session.name} - ${session.context || 'No description'}`
    ).join('\n');

    const prompt = `A user is searching for: "${query}"

Here are their saved browser sessions:
${sessionList}

Analyze which sessions are most relevant to their search query. Return ONLY a JSON array of the top 3 most relevant session numbers (1-${sessions.length}), ordered by relevance. Format: [number, number, number]

Example response: [3, 1, 5]`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.settings.model,
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error('AI ranking failed');
      }

      const data = await response.json();
      const responseText = data.content[0].text.trim();

      // Parse the JSON array from response
      const matches = responseText.match(/\[[\d,\s]+\]/);
      if (!matches) {
        throw new Error('Failed to parse AI response');
      }

      const indices = JSON.parse(matches[0]);

      // Convert 1-based indices to actual sessions
      const rankedSessions = indices
        .filter(idx => idx >= 1 && idx <= sessions.length)
        .map(idx => sessions[idx - 1]);

      return rankedSessions;
    } catch (error) {
      console.error('AI ranking failed:', error);
      // Fallback to first 3 sessions
      return sessions.slice(0, 3);
    }
  }

  // Generate tab groups using Claude
  async generateTabGroups(tabs) {
    if (tabs.length === 0) {
      return [];
    }

    const tabList = tabs.map((tab, i) =>
      `${i + 1}. ${tab.title} (${tab.url})`
    ).join('\n');

    const prompt = `Analyze these browser tabs and organize them into logical groups by topic/purpose. Create 2-5 groups maximum.

Tabs:
${tabList}

Return ONLY a JSON array where each group has a "name" and "tabIndices" (1-based indices of tabs). Format:
[{"name": "Group Name", "tabIndices": [1, 2, 3]}, ...]

Example: [{"name": "Documentation", "tabIndices": [1, 3]}, {"name": "Shopping", "tabIndices": [2, 4]}]`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.settings.model,
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Tab grouping failed');
      }

      const data = await response.json();
      const responseText = data.content[0].text.trim();

      // Parse the JSON array from response
      const matches = responseText.match(/\[[\s\S]*\]/);
      if (!matches) {
        throw new Error('Failed to parse AI response');
      }

      const groups = JSON.parse(matches[0]);
      return groups;
    } catch (error) {
      console.error('Tab grouping failed:', error);
      return [];
    }
  }
}

// Make available in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
