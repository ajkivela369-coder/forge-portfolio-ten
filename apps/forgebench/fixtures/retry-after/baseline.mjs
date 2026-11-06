/** Deliberately faulty backlog starter, for trusted local demonstration only. */
export function retryAfterMs(timestamps, now, windowMs, maxRequests) {
  const active = timestamps.filter(t => t <= now && now - t < windowMs).sort((a,b)=>a-b);
  if (active.length < maxRequests) return 0;
  const expiring = active[active.length - maxRequests];
  // BUG: elapsed-time arithmetic subtracts the original timestamp instead of age.
  return Math.max(1, Math.ceil((windowMs - now) - expiring));
}
