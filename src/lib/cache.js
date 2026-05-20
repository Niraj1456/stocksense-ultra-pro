class MemoryCache {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs && Date.now() > entry.expiresAtMs) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    const expiresAtMs = ttlMs ? Date.now() + ttlMs : undefined;
    this._store.set(key, { value, expiresAtMs });
  }
}

const cache = new MemoryCache();

module.exports = { cache, MemoryCache };

