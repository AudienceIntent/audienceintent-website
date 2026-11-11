const fs = require('node:fs');
const assert = require('node:assert/strict');
const page = fs.readFileSync('videos/what-is-aeo/index.html', 'utf8');
assert.equal((page.match(/<h1\b/g) || []).length, 1);
assert.ok(page.includes('https://www.audienceintent.ai/videos/what-is-aeo/'));
assert.ok(page.includes('id="aeo-player"'));
assert.ok(page.includes('data-book=""'));
assert.ok(!page.includes('class="pin"'));
assert.ok(!page.includes('MOCKUP'));
for (const match of page.matchAll(/href="\/videos\/([^/]+)\//g)) {
  assert.ok(fs.existsSync(`videos/${match[1]}/index.html`), 'Series link must exist');
}
for (const [tag] of page.matchAll(/<a(?:\s[^>]*)?>/g)) {
  assert.ok(/\bhref=/.test(tag), 'No anchors without href: ' + tag);
}
const graphs = [...page.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(m => JSON.parse(m[1])['@graph'] || []);
const video = graphs.find(n => n['@type'] === 'VideoObject');
assert.equal(video.duration, 'PT1M38S');
assert.equal(video.hasPart.length, 5);
assert.ok(video.transcript.endsWith("Let's look."));
assert.ok(video.transcript.split(/\s+/).length > 250);
assert.equal(graphs.find(n => n['@type'] === 'FAQPage').mainEntity.length, 4);
assert.ok(fs.readFileSync('sitemap.xml', 'utf8').includes('/videos/what-is-aeo/'));
assert.ok(fs.readFileSync('sitemap-videos.xml', 'utf8').includes('<video:player_loc>'));
assert.ok(fs.readFileSync('robots.txt', 'utf8').includes('sitemap-videos.xml'));
assert.ok(fs.readFileSync('llms.txt', 'utf8').includes('/videos/what-is-aeo/'));
assert.ok(fs.readFileSync('llms-full.txt', 'utf8').includes(video.transcript));
console.log('Video 01 static content, schema, links and discovery tests passed.');
