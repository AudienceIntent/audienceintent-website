// node postprocess-html.test.js — checks the content-ratio, TOC and
// breadcrumb steps of postprocess-html.js on small fixture pages.
const assert = require('assert');
const { processHtml } = require('./postprocess-html.js');

const page = (canonical, lang, body, head = '') => `<!DOCTYPE html><html lang="${lang}"><head><title>T</title>
<link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/assets/site.css?v=1">${head}
<script type="application/ld+json">{"@context": "https://schema.org", "@graph": [{"@type": "WebPage", "@id": "${canonical}#webpage"}]}</script>
</head><body>${body}</body></html>`;
const ld = (html) => [...html.matchAll(/<script\b[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph']);
const crumbs = (html) => ld(html).filter((n) => n['@type'] === 'BreadcrumbList');

// Breadcrumbs: no one-item trail on the EN homepage, a 2-item trail on /es/
const en = processHtml(page('https://www.audienceintent.ai/', 'en', '<h1>Home</h1>'));
assert.strictEqual(crumbs(en).length, 0, 'EN homepage has no BreadcrumbList');
const es = processHtml(page('https://www.audienceintent.ai/es/', 'es', '<h1>Inicio</h1>'));
assert.deepStrictEqual(crumbs(es)[0].itemListElement.map((i) => i.item), ['https://www.audienceintent.ai/', 'https://www.audienceintent.ai/es/']);
const about = processHtml(page('https://www.audienceintent.ai/about', 'en', '<h1>About</h1>'));
assert.strictEqual(crumbs(about)[0].itemListElement.length, 2, 'inner pages keep Home > page');
assert.ok(!/"@context": /.test(en), 'JSON-LD is minified');

// TOC: anchors for every h2 in .art-body, placed before the first h2
const art = processHtml(page('https://www.audienceintent.ai/insights/x', 'en',
  '<main><h1>X</h1><div class="art-body"><p>Intro</p><h2>What Is AEO?</h2><p>a</p><div><h2>Costs &amp; Plans</h2></div><h2>FAQs</h2><h3>Q?</h3><p>A.</p></div><h2>Outside</h2></main>'));
assert.ok(/<p>Intro<\/p><nav class="toc" aria-label="On this page">/.test(art), 'TOC sits after the intro');
for (const id of ['what-is-aeo', 'costs-and-plans', 'faqs']) {
  assert.ok(art.includes(`<h2 id="${id}">`), 'h2 gets id ' + id);
  assert.ok(art.includes(`href="#${id}"`), 'TOC links to ' + id);
}
assert.ok(!art.includes('href="#outside"'), 'h2s outside .art-body are not listed');
const short = processHtml(page('https://www.audienceintent.ai/insights/y', 'en', '<div class="art-body"><h2>One</h2><h2>Two</h2></div>'));
assert.ok(!short.includes('class="toc'), 'fewer than 3 h2s: no TOC');

// Icons: plain icons go to the sprite, coloured ones to an <image>; animated/stateful ones stay inline
const d = 'M' + '1 2 3 4 '.repeat(60) + 'z';
const icons = processHtml(page('https://www.audienceintent.ai/p', 'en',
  `<a class="social"><svg aria-hidden="true" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${d}"></path></svg></a>` +
  `<i><svg viewBox="0 0 24 24"><title>Gem</title><path d="${d}" fill="url(#g)"></path><defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop stop-color="#08B962"></stop></linearGradient></defs></svg></i>` +
  `<svg viewBox="0 0 10 10"><circle id="ring" class="x" cx="5" cy="5" r="4" style="stroke:red"></circle><path d="${d}"></path></svg>`));
assert.ok(/<svg aria-hidden="true" viewbox="0 0 24 24"><use href="\/assets\/gen\/icons\.svg#i[0-9a-f]{10}"><\/use><\/svg>/.test(icons), 'plain icon uses the sprite');
assert.ok(/<svg viewBox="0 0 24 24"><title>Gem<\/title><image href="\/assets\/gen\/[0-9a-f]{10}\.svg" x="0" y="0" width="24" height="24"><\/image><\/svg>/.test(icons), 'gradient icon becomes an image');
assert.ok(icons.includes('id="ring"'), 'icons with ids/classes/styles stay inline');

// Large inline head CSS and body JS move to hashed files
const big = processHtml(page('https://www.audienceintent.ai/q', 'en', `<script>${'var a=1;'.repeat(300)}</script>`, `<style>${'.a{color:#000}'.repeat(100)}</style>`));
assert.ok(/<style data-css="\/assets\/gen\/[0-9a-f]{10}\.css"><\/style>/.test(big), 'head CSS externalised and loaded by the CSS loader');
assert.ok(/<script src="\/assets\/gen\/[0-9a-f]{10}\.js"><\/script>/.test(big), 'body JS externalised');

// Idempotent
for (const h of [en, es, art, icons, big]) assert.strictEqual(processHtml(h), h, 'second run changes nothing');
console.log('postprocess-html.test.js: all checks passed');
