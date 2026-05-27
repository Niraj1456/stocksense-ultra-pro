class MemoryCache {
  constructor(maxSize = 500) {
    this._store = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (entry.expiresAtMs && Date.now() > entry.expiresAtMs) {
      this._store.delete(key);
      return undefined;
    }
    
    // Refresh access order (LRU) by deleting and re-setting
    this._store.delete(key);
    this._store.set(key, entry);
    
    return entry.value;
  }

  set(key, value, ttlMs) {
    // Delete existing to refresh insertion order on re-write
    if (this._store.has(key)) {
      this._store.delete(key);
    }
    
    const expiresAtMs = ttlMs ? Date.now() + ttlMs : undefined;
    
    // Check size limits and evict the oldest (first key in insertion order)
    if (this._store.size >= this.maxSize) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }
    
    this._store.set(key, { value, expiresAtMs });
  }

  clear() {
    this._store.clear();
  }
}

const cache = new MemoryCache();

module.exports = { cache, MemoryCache };

