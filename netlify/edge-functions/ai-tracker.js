// ============================================================
// ai-tracker.js — Netlify Edge Function
// Location: netlify/edge-functions/ai-tracker.js
// Runs on every request via netlify.toml: path = "/*"
//
// What it does:
//   1. Detects AI crawler and search bot user agents (O(1) lookup)
//   2. Adds AI-friendly response headers when a bot is detected
//   3. Logs the visit to Searchable with platform + geo + referrer
//
// Updated: May 2026
// Crawler list synced with robots.txt
// ============================================================

// ── AI CRAWLER REGISTRY ──────────────────────────────────────
// Map keyed by LOWERCASE token → platform.
// Lowercase keys allow case-insensitive UA matching with one
// .toLowerCase() call instead of per-bot string ops.
// Synced with /robots.txt.
const AI_CRAWLER_MAP = new Map([

  // OpenAI / ChatGPT
  ['gptbot',                'ChatGPT'],
  ['chatgpt-user',          'ChatGPT'],
  ['oai-searchbot',         'ChatGPT'],

  // Anthropic / Claude
  ['claudebot',             'Claude'],
  ['anthropic-ai',          'Claude'],
  ['claude-web',            'Claude'],

  // Google / Gemini
  ['google-extended',       'Gemini'],
  ['gemini-ai',             'Gemini'],
  ['gemini-crawler',        'Gemini'],
  ['googleother',           'Google'],

  // xAI / Grok
  ['grok',                  'Grok'],
  ['xai',                   'Grok'],
  ['grok-bot',              'Grok'],

  // Perplexity
  ['perplexitybot',         'Perplexity'],
  ['perplexity-user',       'Perplexity'],

  // Meta AI
  ['meta-externalagent',    'MetaAI'],
  ['meta-externalfetcher',  'MetaAI'],

  // Apple / Siri
  ['applebot',              'Siri'],
  ['applebot-extended',     'Siri'],

  // Cohere
  ['cohere-ai',             'Cohere'],

  // Mistral
  ['mistralbot',            'Mistral'],

  // DuckDuckGo AI
  ['duckassistbot',         'DuckAssist'],

  // Microsoft Copilot / Bing AI
  ['msedgebot',             'Copilot'],
  ['bingbot',               'Bing'],

  // Amazon Alexa / Rufus
  ['amazonbot',             'Amazon'],

  // You.com
  ['youbot',                'You.com'],

  // ByteDance / TikTok AI
  ['bytespider',            'ByteDance'],

  // Common Crawl (foundation dataset for most LLM training)
  ['ccbot',                 'CommonCrawl'],
]);

// ── CONFIG ────────────────────────────────────────────────────
// Top-level constants make future migration to env vars trivial:
// just swap the literal values for Netlify.env.get(...) calls.
const TRACKER_ENDPOINT = 'https://searchable-tracker.searchable.workers.dev/v1/events';
const TRACKER_TIMEOUT  = 3000; // ms — never let tracking stall
const SITE_TOKEN       = 'st_1627587e11627fb2ed494c94';
const API_TOKEN        = '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.eeb4d4e1aad192805a110c97900e576bd3c52248cb52ece68caf5c80eb8017a8';

// ── DETECT CRAWLER ───────────────────────────────────────────
// Case-insensitive scan across all known bot tokens.
// Returns { token, platform } or null.
function detectCrawler(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const [token, platform] of AI_CRAWLER_MAP) {
    if (ua.includes(token)) {
      return { token, platform };
    }
  }
  return null;
}

// ── EDGE FUNCTION ────────────────────────────────────────────
export default async (request, context) => {
  const ua      = request.headers.get('user-agent') || '';
  const crawler = detectCrawler(ua);

  // Continue request normally (non-crawler path exits early)
  const response = await context.next();
  if (!crawler) return response;

  const url       = new URL(request.url);
  const referrer  = request.headers.get('referer') || '';
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // ── ADD AI-FRIENDLY RESPONSE HEADERS ──────────────────────
  // Signal to the crawler that:
  //   - This content is explicitly permitted for AI indexing
  //   - Full snippets and image previews are allowed
  //   - Request ID is available for support traceability
  const headers = new Headers(response.headers);
  headers.set('X-AI-Content',       'allowed');
  headers.set('X-Robots-Tag',       'index, follow, max-snippet:-1, max-image-preview:large');
  headers.set('X-Crawler-Platform', crawler.platform);
  headers.set('X-Request-ID',       requestId);

  const enhancedResponse = new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });

  // ── TRACK THE AI VISIT (non-blocking, timed out) ──────────
  context.waitUntil((async () => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), TRACKER_TIMEOUT);

    try {
      const geo = context.geo || {};

      await fetch(TRACKER_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          site_token: SITE_TOKEN,
          events: [{
            event_name:       'ai_crawler_visit',
            request_id:       requestId,
            timestamp:        startTime,
            method:           request.method,
            path:             url.pathname,
            url:              request.url,
            status_code:      response.status,
            response_time_ms: Date.now() - startTime,
            user_agent:       ua,
            platform:         crawler.platform,
            crawler_token:    crawler.token,
            referrer:         referrer,
            is_insights:      url.pathname.startsWith('/insights'),
            country:          geo.country?.code || '',
            region:           geo.subdivision?.code || '',
            city:             geo.city || '',
          }],
        }),
      });
    } catch (err) {
      // Silent fail — never let tracking break a response.
      // AbortError is expected if request exceeds TRACKER_TIMEOUT.
    } finally {
      clearTimeout(timeoutId);
    }
  })());

  return enhancedResponse;
};

// Run on every path
export const config = { path: '/*' };
