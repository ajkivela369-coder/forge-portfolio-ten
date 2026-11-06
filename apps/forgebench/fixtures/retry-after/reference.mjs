/** Reviewed reference implementation for the *public demonstration only*. */
export function retryAfterMs(timestamps, now, windowMs, maxRequests) {
  if (!Array.isArray(timestamps) ||
      ![now,windowMs,maxRequests].every(Number.isFinite) ||
      !Number.isInteger(maxRequests) || maxRequests < 1 || windowMs <= 0)
    throw new TypeError("Expected finite timestamps, positive window and quota");
  if (timestamps.some(t => !Number.isFinite(t))) throw new TypeError("Invalid timestamp");
  const active = timestamps.filter(t => t <= now && now - t < windowMs).sort((a,b)=>a-b);
  if (active.length < maxRequests) return 0;
  const expiring = active[active.length - maxRequests];
  return Math.max(1, Math.ceil(windowMs - (now - expiring)));
}
