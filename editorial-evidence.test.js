// Audit regression: inspect the static, server-readable content (no JavaScript required).
// Run after the article and video generators.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const flags = {
  "insights/aeo-vs-seo": "q",
  "insights/ai-recommended-your-competitor-not-you-heres-the-revenue-math": "q",
  "insights/chatgpt-just-launched-business-hub-heres-what-it-means-for-how-customers-find-you": "q",
  "insights/do-you-know-the-36-other-places-ai-checks-before-recommending-you": "q",
  "insights/how-ai-search-engines-like-chatgpt-decide-which-businesses-to-recommend-and-how-to-be-one-of-them": "q",
  "insights/how-audienceintent-measures-ai-visibility-every-metric-score-and-attribution-model-explained": "q",
  "insights/how-much-does-ai-search-visibility-cost": "q",
  "insights/how-to-find-an-answer-engine-optimization-agency-in-2026": "qs",
  "insights/how-to-get-your-business-recommended-by-ai-search-engines": "q",
  "insights/how-to-measure-the-success-of-an-aeo-campaign-metrics-kpis-and-benchmarks-for-2026": "q",
  "insights/how-vault-metal-went-from-invisible-in-ai-to-7-808-mentions-in-90-days": "b",
  "insights/if-a-miami-homeowner-asks-ai-who-to-call-for-their-roof-will-your-name-come-up": "q",
  "insights/kevin-bovett-earns-hubspot-academy-aeo-fundamentals-certification": "q",
  "insights/no-one-can-guarantee-youll-be-the-number-1-answer-in-ai-search-heres-what-actually-works": "qs",
  "insights/were-now-a-searchable-certified-agency-partner-heres-what-that-actually-means-for-your-ai-search-strategy": "qs",
  "insights/what-is-ai-recommended-and-how-does-it-work-the-complete-guide-to-getting-cited-by-chatgpt-gemini-and-perplexity": "q",
  "insights/what-is-answer-engine-optimization-aeo-the-complete-guide-for-2026": "q",
  "insights/why-chatgpt-doesnt-recommend-your-business-and-how-to-fix-it": "q",
  "insights/why-we-support-charity-water": "qb",
  "videos/aeo-vs-seo": "qs",
  "videos/branded-vs-unbranded-prompts": "sb",
  "videos/does-anyone-use-ai-search": "qb",
  "videos/how-aeo-works-can-i-do-it-myself": "s",
  "videos/how-ai-decides-who-to-recommend": "s",
  "videos/how-do-i-know-aeo-is-working": "sb",
  "videos/how-do-you-track-aeo": "sb",
  "videos/how-long-does-aeo-take": "qs",
  "videos/is-aeo-right-for-my-business": "s",
  "videos/is-my-business-showing-up-in-ai": "qsb",
  "videos/what-if-ai-says-the-wrong-thing": "qsb",
  "videos/what-is-a-prompt": "sb",
  "videos/what-is-aeo": "qsb",
  "videos/where-to-find-customer-questions": "qsb",
  "videos/which-ai-engines-matter": "qs",
  "videos/why-ai-recommends-my-competitor": "sb"
};

for (const [url, checks] of Object.entries(flags)) {
  const html = fs.readFileSync(path.join(__dirname, url, 'index.html'), 'utf8');
  const body = html.split('<div class="art-body">').pop();
  if (checks.includes('q')) assert.match(body, /<blockquote[^>]*><p>“[\s\S]*?”<\/p><\/blockquote>\s*<p>[^<]+? · <a href="https:\/\//, 'Linked attribution: '+url);
  if (checks.includes('s')) assert.match(body, /<h2[^>]*>Sources<\/h2>\s*<ul><li><a href="https:\/\//, 'Linked source list: '+url);
  if (checks.includes('b')) {
    assert.match(body, /<strong>(?:Benefit|What it shows|What you can verify):<\/strong>/, 'Benefit: '+url);
    assert.match(body, /<strong>(?:Limitation|What it cannot show|What takes longer):<\/strong>/, 'Limitation: '+url);
  }
}
console.log('Editorial coverage: 26 linked attributions, 18 source lists, 12 balanced notes.');
