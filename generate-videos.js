// Supplement the article build with all published, static video watch pages.
// Metadata lives beside each page; no second hard-coded episode/card list.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const site = 'https://www.audienceintent.ai';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const videos = fs.readdirSync(path.join(root, 'videos'), {withFileTypes:true})
  .filter(d => d.isDirectory() && fs.existsSync(path.join(root, 'videos', d.name, 'video.json')))
  .map(d => {
    const video = JSON.parse(fs.readFileSync(path.join(root, 'videos', d.name, 'video.json'), 'utf8'));
    if (!fs.existsSync(path.join(root, 'videos', d.name, 'index.html'))) throw new Error('Missing watch page: ' + d.name);
    if (video.url !== `${site}/videos/${d.name}/`) throw new Error('Mismatched canonical: ' + d.name);
    return video;
  }).sort((a,b) => a.position - b.position);
if (!videos.length || videos.some((v,i) => v.position !== i+1)) throw new Error('Video positions must be unique and consecutive from 1.');
function durationSeconds(video) {
  const p = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(video.duration);
  if (!p) throw new Error('Invalid duration: ' + video.url);
  return (+p[1] || 0) * 3600 + (+p[2] || 0) * 60 + (+p[3] || 0);
}
let sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
// Remove all prior video entries, not only duplicates, before rebuilding.
sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/www\.audienceintent\.ai\/videos\/[^<]+<\/loc>[\s\S]*?<\/url>/g, '');
sitemap = sitemap.replace('</urlset>', videos.map(v =>
  `  <url><loc>${esc(v.url)}</loc><lastmod>${esc(v.uploadDate.slice(0,10))}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
).join('\n') + '\n</urlset>');
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
const videoSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videos.map(v => `  <url><loc>${esc(v.url)}</loc><video:video>
    <video:thumbnail_loc>${esc(v.thumbnailUrl[0])}</video:thumbnail_loc>
    <video:title>${esc(v.name)}</video:title>
    <video:description>${esc(v.description)}</video:description>
    <video:player_loc>${esc(v.embedUrl)}</video:player_loc>
    <video:duration>${durationSeconds(v)}</video:duration>
    <video:family_friendly>yes</video:family_friendly>
  </video:video></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(root, 'sitemap-videos.xml'), videoSitemap);
let robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes('sitemap-videos.xml')) {
  fs.writeFileSync(path.join(root, 'robots.txt'), robots.trimEnd() + '\nSitemap: https://www.audienceintent.ai/sitemap-videos.xml\n');
}
for (const file of ['llms.txt', 'llms-full.txt']) {
  let text = fs.readFileSync(path.join(root, file), 'utf8');
  text = text.replace(/\n## AEO video answers\n[\s\S]*$/, '').trimEnd();
  text += '\n\n## AEO video answers\n\n' + videos.map(v =>
    `- [Video ${String(v.position).padStart(2,'0')}: ${v.name}](${v.url}): ${v.description}`
  ).join('\n') + '\n';
  if (file === 'llms-full.txt') text += videos.map(v =>
    `\n### Video ${String(v.position).padStart(2,'0')}: ${v.name}\n\n${v.transcript}\n`
  ).join('');
  fs.writeFileSync(path.join(root, file), text);
}

// Add the whole series after the article build refreshes the crawlable Answers grid.
const hubPath = path.join(root, 'insights/index.html');
let hub = fs.readFileSync(hubPath, 'utf8');
const cards = videos.map(v => {
  const first = v.position === 1, n = String(v.position).padStart(2,'0');
  const sec = durationSeconds(v), duration = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
  return `<a class="${first ? 'card-featured' : 'card'} video-card" href="${esc(new URL(v.url).pathname)}" data-format="videos" data-cat="AI Recommended" data-episode="${v.position}">
  <div class="card-img-wrap"><img class="card-img" src="${esc(new URL(v.thumbnailUrl[0]).pathname)}" alt="${esc(v.name)}" loading="${first ? 'eager' : 'lazy'}" decoding="async" width="1280" height="720"><span class="video-play" aria-hidden="true">&#9654;</span></div>
  <div class="card-body"><div class="card-cat">${first ? 'Start here &middot; ' : ''}Video ${n} of ${videos.length}</div>
  <h2 class="card-title">${esc(v.name)}</h2>
  <div class="card-excerpt">${esc(v.description)}</div>
  <div class="card-foot"><span>${duration} &middot; Video</span><span>Watch video &rarr;</span></div></div></a>`;
}).join('\n');
if (!/<div class="grid" id="grid">/.test(hub)) throw new Error('Answers grid not found');
hub = hub.replace(/(<div class="grid" id="grid">)([\s\S]*?)(<\/div>\s*<div class="no-results")/, (_, open, grid, close) => {
  grid = grid.replace(/<a class="(?:card-featured|card) video-card"[\s\S]*?<\/a>/g, '');
  grid = grid.replace(/class="card-featured"/g, 'class="card"');
  return open + '\n' + cards + '\n' + grid.trim() + '\n' + close;
});
// Reuse the existing CollectionPage graph; expose a crawlable, ordered series list.
hub = hub.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_, raw) => {
  const data = JSON.parse(raw);
  data['@graph'] = data['@graph'].filter(n => n['@id'] !== `${site}/insights#video-series` && n['@id'] !== `${site}/insights#video-list`);
  data['@graph'].push({
    '@type':'CreativeWorkSeries', '@id':`${site}/insights#video-series`,
    name:'AEO Explained: 18 Questions, in Order', url:`${site}/insights?format=videos`,
    hasPart:videos.map(v => ({'@id':v['@id']}))
  }, {
    '@type':'ItemList', '@id':`${site}/insights#video-list`, name:'AEO Explained video series',
    itemListOrder:'https://schema.org/ItemListOrderAscending', numberOfItems:videos.length,
    itemListElement:videos.map(v => ({'@type':'ListItem',position:v.position,url:v.url,name:v.name}))
  });
  return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
});
fs.writeFileSync(hubPath, hub);
console.log(`Videos 01–${videos.length}: Answers cards, ordered schema, sitemaps and AI reading files updated.`);
