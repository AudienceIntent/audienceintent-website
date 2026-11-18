const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fresh = 'AI engines like ChatGPT and Perplexity favor content that’s current. About half of what they cite was published or updated in the last three months.';
for (const [file, text] of [['index.html', fresh], ['es/index.html', 'Cerca de la mitad del contenido que citan se publicó o actualizó en los últimos tres meses.']]) {
  const html = fs.readFileSync(file, 'utf8');
  assert.equal(html.split(text).length - 1, 3, `${file}: package copy, FAQ and FAQ schema agree`);
  assert(!/almost invisible|casi invisible/.test(html), `${file}: no stale expiration claim`);
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
}
for (const file of fs.readdirSync('insights').filter(f => f.endsWith('.md'))) {
  const md = fs.readFileSync(path.join('insights', file), 'utf8');
  assert(!/(?:content|updated|published)[^.\n]*?(?:under|within the last) 30 days/i.test(md), `${file}: no 30-day freshness cutoff`);
}
const full = fs.readFileSync('llms-full.txt', 'utf8');
assert(!full.includes('content under 30 days old'));
assert(!full.includes('Updated within the last 30 days'));
assert(full.includes(fresh));
console.log('Content freshness regression checks passed');
