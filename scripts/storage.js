// Storage utility for managing sessions and embeddings

class StorageService {
  static async getSessions() {
    const result = await chrome.storage.local.get(['sessions']);
    return result.sessions || [];
  }

  static async saveSessions(sessions) {
    await chrome.storage.local.set({ sessions });
  }

  static async addSession(session) {
    const sessions = await this.getSessions();
    sessions.unshift(session);
    await this.saveSessions(sessions);
    return session;
  }

  static async updateSession(sessionId, updates) {
    const sessions = await this.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);

    if (index === -1) {
      throw new Error('Session not found');
    }

    sessions[index] = { ...sessions[index], ...updates };
    await this.saveSessions(sessions);
    return sessions[index];
  }

  static async deleteSession(sessionId) {
    const sessions = await this.getSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    await this.saveSessions(filtered);
  }

  static async getSettings() {
    const result = await chrome.storage.local.get(['settings']);
    return result.settings || {
      aiProvider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      searchSensitivity: 7,
      autoContext: true
    };
  }

  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }

  // Embedding storage using IndexedDB for better performance
  static async openEmbeddingsDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TabSessionEmbeddings', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('embeddings')) {
          db.createObjectStore('embeddings', { keyPath: 'sessionId' });
        }
      };
    });
  }

  static async saveEmbedding(sessionId, embedding) {
    const db = await this.openEmbeddingsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.put({ sessionId, embedding, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async getEmbedding(sessionId) {
    const db = await this.openEmbeddingsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.get(sessionId);

      request.onsuccess = () => {
        resolve(request.result ? request.result.embedding : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getAllEmbeddings() {
    const db = await this.openEmbeddingsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteEmbedding(sessionId) {
    const db = await this.openEmbeddingsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.delete(sessionId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async clearAllEmbeddings() {
    const db = await this.openEmbeddingsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Make available in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
