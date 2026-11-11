// Supplement the article build with the one approved-for-review video page.
// Keep video indexing in the build so later article deploys do not erase it.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const url = 'https://www.audienceintent.ai/videos/what-is-aeo/';
const video = JSON.parse(fs.readFileSync(path.join(root, 'videos/what-is-aeo/video.json'), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lastmod = '2026-11-11';
let sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
if (!sitemap.includes(`<loc>${url}</loc>`)) {
  sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`);
  fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
}
const videoSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${url}</loc><video:video>
    <video:thumbnail_loc>${esc(video.thumbnailUrl[0])}</video:thumbnail_loc>
    <video:title>${esc(video.name)}</video:title>
    <video:description>${esc(video.description)}</video:description>
    <video:player_loc>${esc(video.embedUrl)}</video:player_loc>
    <video:duration>98</video:duration>
    <video:family_friendly>yes</video:family_friendly>
  </video:video></url>
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
  text += `\n\n## AEO video answers\n\n- [${video.name}](${url}): ${video.description}\n`;
  if (file === 'llms-full.txt') text += `\n### Video transcript\n\n${video.transcript}\n`;
  fs.writeFileSync(path.join(root, file), text);
}
console.log('Video 01: sitemap, video sitemap, robots and AI reading files updated.');

// Add the watch page to Answers after the article build has refreshed its grid.
// Read live-page metadata rather than maintaining a second list of video copy.
const hubPath = path.join(root, 'insights/index.html');
let hub = fs.readFileSync(hubPath, 'utf8');
const durationParts = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(video.duration);
const totalSeconds = durationParts ? (+durationParts[1] || 0) * 3600 + (+durationParts[2] || 0) * 60 + (+durationParts[3] || 0) : 0;
const durationLabel = Math.floor(totalSeconds / 60) + ':' + String(totalSeconds % 60).padStart(2, '0');
const card = `<a class="card-featured video-card" href="${esc(video.url)}" data-format="videos" data-cat="AI Recommended">
  <div class="card-img-wrap"><img class="card-img" src="${esc(video.thumbnailUrl[0])}" alt="${esc(video.name)}" loading="eager" decoding="async" width="1280" height="720"><span class="video-play" aria-hidden="true">&#9654;</span></div>
  <div class="card-body"><div class="card-cat">Start here &middot; Video 01</div>
  <h2 class="card-title">${esc(video.name)}</h2>
  <div class="card-excerpt">New to AEO? Start with this short video on how AI finds, understands and recommends a business.</div>
  <div class="card-foot"><span>${esc(durationLabel)} &middot; Video</span><span>Watch video &rarr;</span></div></div></a>`;
hub = hub.replace(/(<div class="grid" id="grid">)([\s\S]*?)(<\/div>\s*<div class="no-results")/, (_, open, grid, close) => {
  // Idempotent even if this supplement is run twice without the article build.
  grid = grid.replace(/<a class="card-featured video-card"[\s\S]*?<\/a>/g, '');
  grid = grid.replace(/class="card-featured"/g, 'class="card"');
  return open + '\n' + card + grid + '\n' + close;
});
fs.writeFileSync(hubPath, hub);
console.log('Answers: Video 01 featured card added.');
