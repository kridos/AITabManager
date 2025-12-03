// AI Service for generating context descriptions and embeddings

class AIService {
  constructor(settings) {
    this.settings = settings;
  }

  async generateContext(tabs) {
    if (!this.settings.apiKey) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }

    const provider = this.settings.aiProvider;

    if (provider === 'anthropic') {
      return await this.generateContextAnthropic(tabs);
    } else if (provider === 'openai') {
      return await this.generateContextOpenAI(tabs);
    } else {
      throw new Error('Unsupported AI provider');
    }
  }

  async generateContextAnthropic(tabs) {
    const tabList = tabs.map((tab, i) =>
      `${i + 1}. ${tab.title} (${tab.url})`
    ).join('\n');

    const prompt = `Analyze these browser tabs and generate a concise, searchable description of what the user was working on. Focus on the main topic, purpose, and key themes. Keep it under 100 words.

Tabs:
${tabList}

Provide a natural language description that someone could use to search for this session later.`;

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

  async generateContextOpenAI(tabs) {
    const tabList = tabs.map((tab, i) =>
      `${i + 1}. ${tab.title} (${tab.url})`
    ).join('\n');

    const prompt = `Analyze these browser tabs and generate a concise, searchable description of what the user was working on. Focus on the main topic, purpose, and key themes. Keep it under 100 words.

Tabs:
${tabList}

Provide a natural language description that someone could use to search for this session later.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async generateEmbedding(text) {
    if (!this.settings.apiKey) {
      throw new Error('API key not configured');
    }

    const provider = this.settings.aiProvider;

    if (provider === 'openai') {
      return await this.generateEmbeddingOpenAI(text);
    } else if (provider === 'anthropic') {
      // Anthropic doesn't provide embeddings, use OpenAI's text-embedding-3-small
      // User would need to provide an OpenAI key for embeddings
      throw new Error('Please use OpenAI for embeddings. Anthropic does not provide embedding models.');
    }
  }

  async generateEmbeddingOpenAI(text) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  // Calculate cosine similarity between two vectors
  static cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Use AI to rank sessions by relevance to search query
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
      const provider = this.settings.aiProvider;
      let responseText;

      if (provider === 'anthropic') {
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
        responseText = data.content[0].text.trim();
      } else if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify({
            model: this.settings.model,
            messages: [{
              role: 'user',
              content: prompt
            }],
            max_tokens: 100
          })
        });

        if (!response.ok) {
          throw new Error('AI ranking failed');
        }

        const data = await response.json();
        responseText = data.choices[0].message.content.trim();
      }

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

  // Generate tab groups using AI
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
      const provider = this.settings.aiProvider;
      let responseText;

      if (provider === 'anthropic') {
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
        responseText = data.content[0].text.trim();
      } else if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify({
            model: this.settings.model,
            messages: [{
              role: 'user',
              content: prompt
            }],
            max_tokens: 300
          })
        });

        if (!response.ok) {
          throw new Error('Tab grouping failed');
        }

        const data = await response.json();
        responseText = data.choices[0].message.content.trim();
      }

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
