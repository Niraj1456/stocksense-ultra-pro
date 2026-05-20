class TokenBucket {
  constructor({ capacity, refillPerMs }) {
    this.capacity = capacity;
    this.refillPerMs = refillPerMs;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  async take(tokens = 1) {
    while (true) {
      this._refill();
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      const missing = tokens - this.tokens;
      const waitMs = Math.ceil(missing / this.refillPerMs);
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)));
    }
  }
}

// Very conservative defaults; can be tuned per domain.
const buckets = new Map();

function getBucket(domain) {
  if (buckets.has(domain)) return buckets.get(domain);
  const bucket = new TokenBucket({ capacity: 5, refillPerMs: 5 / 1000 }); // ~5 rps burst 5
  buckets.set(domain, bucket);
  return bucket;
}

async function throttle(domain) {
  const b = getBucket(domain);
  await b.take(1);
}

module.exports = { throttle };

