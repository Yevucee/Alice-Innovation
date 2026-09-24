const buckets = new Map<string, { tokens: number; updated: number }>();

export function allowRequest(key: string, limitPerMinute = 60, now = Date.now()): boolean {
  const bucket = buckets.get(key) ?? { tokens: limitPerMinute, updated: now };
  const refill = ((now - bucket.updated) / 60_000) * limitPerMinute;
  bucket.tokens = Math.min(limitPerMinute, bucket.tokens + refill);
  bucket.updated = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
