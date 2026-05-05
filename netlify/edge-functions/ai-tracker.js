const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai',
  'PerplexityBot', 'bingbot', 'YouBot', 'cohere-ai', 'Applebot'
];

export default async (request, context) => {
  const ua = request.headers.get('User-Agent') || '';
  const isAI = AI_CRAWLERS.some(bot => ua.includes(bot));

  const response = await context.next();

  if (isAI) {
    const url = new URL(request.url);

    context.waitUntil(
      fetch('https://searchable-tracker.searchable.workers.dev/v1/events', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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.eeb4d4e1aad192805a110c97900e576bd3c52248cb52ece68caf5c80eb8017a8',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_token: 'st_1627587e11627fb2ed494c94',
          events: [{
            event_name: 'server_request',
            timestamp: Date.now(),
            method: request.method,
            path: url.pathname,
            url: request.url,
            status_code: response.status,
            response_time_ms: 0,
            user_agent: ua
          }]
        })
      })
    );
  }

  return response;
};

export const config = { path: '/*' };
