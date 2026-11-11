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
