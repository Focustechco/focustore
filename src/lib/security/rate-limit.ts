interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

export function rateLimit(identifier: string, limit = 60, windowMs = 60 * 1000): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  // Bound memory usage even when callers rotate identifiers.
  if (memoryStore.size >= 10000) {
    for (const [key, value] of memoryStore) if (value.resetAt <= now) memoryStore.delete(key);
    if (memoryStore.size >= 10000 && !memoryStore.has(identifier)) {
      return { success: false, remaining: 0, resetAt: now + windowMs };
    }
  }
  const record = memoryStore.get(identifier);

  if (!record || now > record.resetAt) {
    const newRecord = { count: 1, resetAt: now + windowMs };
    memoryStore.set(identifier, newRecord);
    return { success: true, remaining: limit - 1, resetAt: newRecord.resetAt };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, resetAt: record.resetAt };
}
