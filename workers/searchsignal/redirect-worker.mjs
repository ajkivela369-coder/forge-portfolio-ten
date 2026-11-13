// SearchSignal redirect evidence service — explicitly allowlisted public hosts only.
// The shipped frontend expects SuperJSON {json: ...}. No arbitrary-host crawling,
// uploaded documents, cookies, credentials, internal targets, or live server changes.
const MAX_BYTES = 16384;
const MAX_MAPPINGS = 8;
const MAX_HOPS = 4;
const MAX_HTML_BYTES = 32768;
const MAX_ELAPSED_MS = 12000;
const DISALLOWED_HOST_SUFFIXES = /(?:^|\.)(?:localhost|local|internal|invalid|test|home|lan|arpa)$/i;

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify({ json: value }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "vary": "Origin",
      ...extraHeaders,
    },
  });
}

function allowedHosts(env) {
  return new Set(String(env.ALLOWED_AUDIT_HOSTS || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
}

export function safeUrl(input, approved) {
  if (typeof input !== "string" || !input || input.length > 2048 ||
      /[\u0000-\u001F\u007F]/.test(input)) throw new Error("Invalid audit URL.");
  let url;
  try { url = new URL(input); } catch { throw new Error("Expected a complete HTTPS URL."); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
      url.port || DISALLOWED_HOST_SUFFIXES.test(host) ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
      !approved.has(host)) {
    throw new Error("Only configured, approved public HTTPS domains can be audited.");
  }
  url.hash = "";
  return url;
}

function resolveMapping(value, base, allowed) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048 ||
      /[\u0000-\u001F\u007F]/.test(value)) throw new Error("Invalid redirect mapping.");
  let url;
  try { url = new URL(value, base); } catch { throw new Error("Invalid redirect mapping."); }
  return safeUrl(url.href, allowed);
}

function apacheRule(source, intended) {
  // This is *documentation*, not an applied web-server configuration.
  const path = source.pathname || "/";
  if (!/^\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]*$/.test(path) || path.includes("\r") || path.includes("\n")) {
    return "Manual redirect-rule review required";
  }
  const destination = source.origin === intended.origin
    ? intended.pathname + intended.search
    : intended.href;
  if (source.href === intended.href) return "No redirect proposed: source and destination are identical.";
  return "Redirect 301 " + path + " " + destination;
}

function findCanonical(html, base) {
  for (const tag of html.match(/<link\b[^>]{0,1500}>/gi)?.slice(0, 80) || []) {
    const rel = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (!rel.split(/\s+/).includes("canonical")) continue;
    const href = /\bhref\s*=\s*["']([^"']{1,1000})["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      const value = new URL(href, base);
      return (value.protocol === "https:" || value.protocol === "http:") ? value.href : null;
    } catch { return null; }
  }
  return null;
}

async function readBounded(stream, max = MAX_HTML_BYTES) {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "", used = 0;
  try {
    while (used < max) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const portion = value.subarray(0, Math.min(value.byteLength, max - used));
      output += decoder.decode(portion, {stream:true});
      used += portion.byteLength;
    }
    output += decoder.decode();
  } finally { try { await reader.cancel(); } catch { /* already closed */ } }
  return output;
}

async function parseLimitedBody(req) {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("Request too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Expected JSON input.");
  const decoder = new TextDecoder();
  let size = 0, body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Request too large.");
      body += decoder.decode(value, {stream:true});
    }
    body += decoder.decode();
  } finally { try { await reader.cancel(); } catch { /* already closed */ } }
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error("Malformed JSON input."); }
  // SuperJSON client protocol — accept plain JSON as well for compatibility tests.
  return (payload && typeof payload === "object" && payload.json !== undefined)
    ? payload.json : payload;
}

export function validatePayload(value, approved) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected baseUrl and mappings.");
  const base = safeUrl(value.baseUrl, approved);
  if (!Array.isArray(value.mappings) || value.mappings.length < 1 ||
      value.mappings.length > MAX_MAPPINGS) {
    throw new Error("Provide 1–8 redirect mappings per request.");
  }
  return value.mappings.map(mapping => {
    if (!mapping || typeof mapping !== "object") throw new Error("Invalid mapping.");
    const source = resolveMapping(mapping.from, base, approved);
    const destination = resolveMapping(mapping.to, base, approved);
    return { source, destination };
  });
}

async function inspectRedirect({ source, destination }, approved, fetcher, timeStarted) {
  const chain = [];
  let current = source, observedStatus = null, finalUrl = null,
    finalCanonical = null, failure = null, truncated = false;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (Date.now() - timeStarted >= MAX_ELAPSED_MS) { failure = "Audit timed out."; break; }
    // Recheck every redirect target; never auto-follow a response.
    try { current = safeUrl(current.href, approved); }
    catch { failure = "Redirect points outside approved domains."; break; }
    const aborter = new AbortController();
    const watchdog = setTimeout(() => aborter.abort(), 3500);
    let response;
    try {
      response = await fetcher(current.href, {
        method: "GET",
        redirect: "manual",
        headers: { "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1" },
        signal: aborter.signal,
        cache: "no-store",
      });
    } catch {
      failure = "Request failed or remote server was unreachable.";
      clearTimeout(watchdog);
      break;
    }
    if (observedStatus === null) observedStatus = response.status;
    const location = response.headers.get("location");
    chain.push({ url: current.href, status: response.status, location: location || null });
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      if (hop >= MAX_HOPS) { failure = "Redirect chain exceeds four hops."; truncated = true; clearTimeout(watchdog); break; }
      let next;
      try { next = resolveMapping(location, current, approved); }
      catch { failure = "Redirect points outside approved domains."; clearTimeout(watchdog); break; }
      current = next;
      try { await response.body?.cancel(); } catch { /* no body */ }
      clearTimeout(watchdog);
      continue;
    }
    finalUrl = current.href;
    if ((response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
      try { finalCanonical = findCanonical(await readBounded(response.body), finalUrl); }
      catch { finalCanonical = null; }
    } else {
      try { await response.body?.cancel(); } catch { /* no body */ }
    }
    clearTimeout(watchdog);
    break;
  }
  return {
    sourceUrl: source.href,
    intendedDestination: destination.href,
    observedStatus,
    finalUrl,
    finalCanonical,
    chain,
    proposedApacheRule: apacheRule(source, destination),
    reachesIntendedDestination: finalUrl !== null && finalUrl === destination.href &&
      chain.some(item => [301, 302, 303, 307, 308].includes(item.status) && item.location) &&
      chain.length > 0 && chain[chain.length - 1].status >= 200 && chain[chain.length - 1].status < 400,
    error: failure,
    truncated,
  };
}

export async function handleRedirectValidation(request, env, fetcher = fetch) {
  if (request.method !== "POST") return json({error:"Use POST with JSON."},405,{allow:"POST"});
  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) return json({error:"Same-origin requests only."},403);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json({error:"Content-Type must be application/json."},415);
  }
  if (!env.SEARCHSIGNAL_RATE?.limit) return json({error:"Audit rate limiter is unavailable."},503);
  try {
    const value = await parseLimitedBody(request);
    const approved = allowedHosts(env);
    const mappings = validatePayload(value, approved);
    const key = "redirect:" + (request.headers.get("cf-connecting-ip") || "anonymous");
    const verdict = await env.SEARCHSIGNAL_RATE.limit({key,delta:mappings.length});
    if (!verdict.success) return json({error:"Audit limit reached; try again later."},429,{"retry-after":"60"});
    const timeStarted = Date.now();
    const results = [];
    for (const mapping of mappings) {
      results.push(await inspectRedirect(mapping, approved, fetcher, timeStarted));
    }
    return json({results, scope:"approved public HTTPS domains", checkedAt:new Date().toISOString()});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid audit request.";
    return json({error:message},422);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/redirect-validate") return handleRedirectValidation(request, env);
    // Production currently serves the SPA shell on /api/ember/*.
    // Preserve the observed behavior; do not activate a dormant service-binding route.
    return env.ASSETS.fetch(request);
  },
};
