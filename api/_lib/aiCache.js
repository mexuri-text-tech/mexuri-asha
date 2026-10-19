// Short-lived in-memory cache for safe, context-free AI responses.
// Process-local by design: this is a best-effort optimization, not a source of truth.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map();

function prune(now) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export function normalizeCacheKey(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCached(key) {
  const now = Date.now();
  prune(now);
  const entry = cache.get(key);
  return entry && entry.expiresAt > now ? entry.value : null;
}

export function setCached(key, value) {
  const now = Date.now();
  prune(now);
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}
