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
}

// Make available in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
