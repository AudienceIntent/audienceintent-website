// Run after node generate-articles.js && node generate-videos.js.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const videos = fs.readdirSync(path.join(root, 'videos'), {withFileTypes:true})
  .filter(d => d.isDirectory() && fs.existsSync(path.join(root,'videos',d.name,'video.json')))
  .map(d => ({slug:d.name,video:JSON.parse(read(`videos/${d.name}/video.json`)),html:read(`videos/${d.name}/index.html`)}))
  .sort((a,b) => a.video.position - b.video.position);
assert.equal(videos.length,18);
const slugs = new Set(videos.map(v => v.slug));
const unescape = s => s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const xml = read('sitemap-videos.xml'), sitemap = read('sitemap.xml'), hub = read('insights/index.html');
assert.equal((xml.match(/<video:video>/g)||[]).length,18);
assert.equal((hub.match(/data-episode=/g)||[]).length,18);
assert.equal((hub.match(/class="card-featured video-card"/g)||[]).length,1);
let priorCardIndex = -1;
for (let i=0;i<videos.length;i++) {
  const {slug,video:v,html:h} = videos[i];
  assert.equal(v.position,i+1);
  assert.equal((h.match(/<h1\b/g)||[]).length,1);
  assert.ok(h.includes(`href="${v.url}"`), 'Canonical: '+slug);
  assert.ok(h.includes(`src="${v.embedUrl}?rel=0"`), 'Correct existing embed: '+slug);
  assert.ok(h.includes('data-book=""'), 'Booking CTA retained');
  assert.ok(h.includes('new MutationObserver(sync)'), 'Booking modal accessible state stays in sync');
  assert.ok(!/\bMOCKUP\b/.test(h));
  const graph = [...h.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(m => JSON.parse(m[1])['@graph'] || []);
  assert.deepEqual(graph.find(n=>n['@type']==='VideoObject'),v);
  const title = unescape(/<title[^>]*>(.*?)<\/title>/.exec(h)[1]);
  if(i>0) assert.ok(title.length<=60, 'Meta title too long: '+title);
  const dur = /^PT(\d+)M(\d+)S$/.exec(v.duration), total = Number(dur[1])*60+Number(dur[2]);
  assert.ok(h.includes(`Number(t)<${i===0 ? 99 : total}`), 'Deep-link bound matches this video');
  let prev = -1;
  for (const clip of v.hasPart) {
    assert.ok(clip.startOffset>prev && clip.startOffset<total && clip.endOffset<=total && clip.endOffset>clip.startOffset);
    assert.ok(h.includes(`data-start="${clip.startOffset}"`));
    assert.ok(h.includes(unescape(clip.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')));
    prev=clip.startOffset;
  }
  const tr = /<div class="tr">([\s\S]*?)<\/div>/.exec(h)[1];
  const spoken = unescape(tr.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,'').replace(/<\/p>/g,' ').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
  assert.equal(spoken,v.transcript.replace(/\s+/g,' ').trim(),'No lost transcript text: '+slug);
  assert.ok(spoken.split(/\s+/).length>150);
  const faq = graph.find(n=>n['@type']==='FAQPage');
  assert.ok(faq.mainEntity.length>=2);
  for(const q of faq.mainEntity) {
    assert.ok(unescape(h).includes(q.name));
    assert.ok(unescape(h).includes(q.acceptedAnswer.text));
  }
  const series = /<div class="series">([\s\S]*?)<\/ol>/.exec(h)[1];
  assert.equal((series.match(/<li\b/g)||[]).length,18);
  assert.equal((series.match(/class="on"/g)||[]).length,1);
  assert.equal((series.match(/href="\/videos\//g)||[]).length,17);
  const next = videos[i+1] || videos[0];
  assert.match(h, new RegExp('class="nextq rel" href="/videos/'+next.slug+'/\"'));
  for (const m of h.matchAll(/<a(?:\s[^>]*)?>/g)) {
    assert.ok(/\bhref=/.test(m[0]),'Anchor without href: '+slug);
  }
  for (const m of h.matchAll(/href="\/videos\/([^/?#]+)\//g)) assert.ok(slugs.has(m[1]),'Unbuilt internal page');
  const image = new URL(v.thumbnailUrl[0]).pathname;
  assert.ok(fs.statSync(path.join(root,image)).size>1000,'Thumbnail exists');
  assert.equal((sitemap.match(new RegExp('<loc>'+v.url+'</loc>','g'))||[]).length,1);
  assert.equal((xml.match(new RegExp('<loc>'+v.url+'</loc>','g'))||[]).length,1);
  assert.ok(read('llms.txt').includes(v.url));
  assert.ok(read('llms-full.txt').includes(v.transcript));
  const cardIndex = hub.indexOf(`data-episode="${i+1}"`);
  assert.ok(cardIndex>priorCardIndex,'Cards in episode order'); priorCardIndex=cardIndex;
  assert.ok(hub.includes(`href="/videos/${slug}/"`), 'Preview-safe card route');
  assert.ok(hub.includes(`src="${image}"`), 'Preview-safe thumbnail asset');
}
assert.ok(read('robots.txt').includes('sitemap-videos.xml'));
const files=['sitemap.xml','sitemap-videos.xml','llms.txt','llms-full.txt','insights/index.html'];
const snapshot=Object.fromEntries(files.map(f=>[f,read(f)]));
cp.execFileSync(process.execPath,['generate-videos.js'],{cwd:root,stdio:'pipe'});
for(const file of files) assert.equal(read(file),snapshot[file],'Repeat video build must be idempotent: '+file);
cp.execFileSync(process.execPath,['generate-articles.js'],{cwd:root,stdio:'pipe'});
cp.execFileSync(process.execPath,['generate-videos.js'],{cwd:root,stdio:'pipe'});
for(const file of files) assert.equal(read(file),snapshot[file],'Article rebuild preserves video discovery: '+file);
console.log('All 18 video pages: transcripts, embeds, chapters, schema, series navigation, thumbnails, ordered hub cards and repeat-build discovery passed.');
