#!/usr/bin/env node
// ============================================================
// postprocess-html.js — runs LAST in the Netlify build
// (after generate-articles.js and generate-videos.js).
//
// Site-wide audit fixes applied to every built HTML page, so new
// pages from any generator or hand edit pick them up automatically:
//   1. <img> without a title attribute gets title = its alt text.
//   2. Local stylesheets load without blocking first render
//      (preload + onload swap, noscript fallback). The page stays
//      hidden on the navy background until CSS is in (max 2.5s), so
//      there is no unstyled or white flash.
//   3. <meta>/<link> attributes are written in the standard order
//      (name/property/rel first, content/href last) so simple
//      regex-based crawlers read descriptions, dates and canonicals.
//   4. JSON-LD: pages that reference Kevin's Person @id get the
//      Person node itself; video watch pages get an Article node
//      that wraps the VideoObject.
// Idempotent: running it twice changes nothing the second time.
// Usage: node postprocess-html.js [rootDir]
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || __dirname);
const SITE = 'https://www.audienceintent.ai';
const PERSON_ID = SITE + '/#kevin-bovett';
const ORG_ID = SITE + '/#organization';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'admin', 'ffp-social', 'netlify', 'fonts', 'images', '.netlify']);
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

const PERSON_NODE = {
  '@type': 'Person',
  '@id': PERSON_ID,
  'name': 'Kevin Bovett',
  'jobTitle': 'Founder',
  'url': SITE + '/about',
  'worksFor': { '@id': ORG_ID },
};

const TAG_RE = (name) => new RegExp(`<${name}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');
const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>"']+))?/g;

function parseAttrs(tag, name) {
  const inner = tag.slice(name.length + 1).replace(/\/?>$/, '');
  const attrs = [];
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner))) {
    let v = m[2];
    if (v !== undefined && /^["']/.test(v)) v = v.slice(1, -1);
    attrs.push([m[1], v]);
  }
  return attrs;
}

function buildTag(name, attrs) {
  return '<' + name + attrs.map(([k, v]) => (v === undefined ? ' ' + k : ` ${k}="${v}"`)).join('') + '>';
}

function getAttr(attrs, k) {
  const a = attrs.find(([n]) => n.toLowerCase() === k);
  return a ? a[1] : undefined;
}

// 1. image titles
function fixImages(html) {
  return html.replace(TAG_RE('img'), (tag) => {
    if (/\stitle\s*=/i.test(tag)) return tag;
    const attrs = parseAttrs(tag, 'img');
    let title = (getAttr(attrs, 'alt') || '').trim();
    if (!title) {
      // decorative images keep alt="" for screen readers; title still set for crawlers
      const src = getAttr(attrs, 'src') || '';
      title = /kevin-bovett/i.test(src) ? 'Kevin Bovett' : 'AudienceIntent';
    }
    return tag.replace(/^<img\b/i, `<img title="${title}"`);
  });
}

// 2. non-blocking stylesheets
const CSS_GUARD = '<style id="css-swap">html{background:#05070d}.css-wait body{opacity:0}</style>' +
  '<script>document.documentElement.classList.add(\'css-wait\');' +
  'setTimeout(function(){document.documentElement.classList.remove(\'css-wait\')},2500)</script>';
const ONLOAD = "this.onload=null;this.rel='stylesheet';document.documentElement.classList.remove('css-wait')";

function fixStylesheets(html) {
  if (html.includes('id="css-swap"')) return html;
  let first = true;
  return html.replace(TAG_RE('link'), (tag) => {
    const attrs = parseAttrs(tag, 'link');
    const rel = (getAttr(attrs, 'rel') || '').toLowerCase();
    const href = getAttr(attrs, 'href') || '';
    const media = getAttr(attrs, 'media');
    if (rel !== 'stylesheet' || !href.startsWith('/') || href.startsWith('//') || (media && media !== 'all')) return tag;
    const out = (first ? CSS_GUARD : '') +
      `<link rel="preload" as="style" href="${href}" onload="${ONLOAD}">` +
      `<noscript><link rel="stylesheet" href="${href}"></noscript>`;
    first = false;
    return out;
  });
}

// 3. standard attribute order
const META_FIRST = ['charset', 'name', 'property', 'http-equiv', 'itemprop', 'id'];
const LINK_FIRST = ['rel', 'id', 'as', 'type', 'sizes', 'hreflang', 'href'];

function reorder(html, name, firstKeys, lastKeys) {
  return html.replace(TAG_RE(name), (tag) => {
    const attrs = parseAttrs(tag, name);
    const rank = (k) => {
      k = k.toLowerCase();
      if (lastKeys.includes(k)) return 100 + lastKeys.indexOf(k);
      const i = firstKeys.indexOf(k);
      return i === -1 ? 50 : i;
    };
    const sorted = attrs.map((a, i) => [a, i]).sort((x, y) => rank(x[0][0]) - rank(y[0][0]) || x[1] - y[1]).map((x) => x[0]);
    if (sorted.every((a, i) => a === attrs[i])) return tag;
    return buildTag(name, sorted);
  });
}

// 4. JSON-LD
function nodesOf(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj['@graph'])) return obj['@graph'];
  return [obj];
}
function typesOf(n) {
  const t = n && n['@type'];
  return Array.isArray(t) ? t : t ? [t] : [];
}
function refsPerson(x) {
  if (Array.isArray(x)) return x.some(refsPerson);
  if (x && typeof x === 'object') return Object.values(x).some(refsPerson);
  return x === PERSON_ID;
}
function toGraph(obj) {
  if (obj && Array.isArray(obj['@graph'])) return obj;
  const nodes = Array.isArray(obj) ? obj : [obj];
  const ctx = (nodes[0] && nodes[0]['@context']) || 'https://schema.org';
  return { '@context': ctx, '@graph': nodes.map(({ ['@context']: _c, ...rest }) => rest) };
}

function fixSchema(html) {
  const re = /(<script\b[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    try { blocks.push({ start: m.index, full: m[0], open: m[1], close: m[3], obj: JSON.parse(m[2]), changed: false }); }
    catch (e) { /* leave invalid blocks alone */ }
  }
  if (!blocks.length) return html;
  const all = () => blocks.flatMap((b) => nodesOf(b.obj));
  const hasTop = (pred) => all().some(pred);

  // Person node wherever Kevin's @id is referenced but not defined at top level
  if (!hasTop((n) => typesOf(n).includes('Person')) && blocks.some((b) => refsPerson(b.obj))) {
    const b = blocks.find((x) => refsPerson(x.obj));
    b.obj = toGraph(b.obj);
    b.obj['@graph'].unshift({ ...PERSON_NODE });
    b.changed = true;
  }

  // Video watch pages: Article wrapping the VideoObject
  const video = all().find((n) => typesOf(n).includes('VideoObject'));
  if (video && !hasTop((n) => typesOf(n).some((t) => ARTICLE_TYPES.has(t)))) {
    const b = blocks.find((x) => nodesOf(x.obj).includes(video));
    const page = nodesOf(b.obj).find((n) => typesOf(n).includes('WebPage')) || {};
    const url = video.url || page.url;
    const thumb = Array.isArray(video.thumbnailUrl) ? video.thumbnailUrl[0] : video.thumbnailUrl;
    const article = {
      '@type': 'Article',
      '@id': url + '#article',
      'headline': String(page.name || video.name || '').slice(0, 110),
      'description': page.description || video.description,
      'image': thumb,
      'datePublished': page.datePublished || video.uploadDate,
      'dateModified': page.dateModified || page.datePublished || video.uploadDate,
      'author': { '@id': PERSON_ID },
      'publisher': { '@id': ORG_ID },
      'mainEntityOfPage': page['@id'] ? { '@id': page['@id'] } : url,
      'video': { '@id': video['@id'] },
      'inLanguage': video.inLanguage || 'en',
    };
    if (video.isPartOf) article.isPartOf = video.isPartOf;
    b.obj = toGraph(b.obj);
    const g = b.obj['@graph'];
    g.splice(g.indexOf(video) + 1, 0, article);
    b.changed = true;
  }

  let out = html;
  for (const b of blocks.slice().reverse()) {
    if (!b.changed) continue;
    const repl = b.open + JSON.stringify(b.obj) + b.close;
    out = out.slice(0, b.start) + repl + out.slice(b.start + b.full.length);
  }
  return out;
}

function processHtml(html) {
  let h = html;
  h = fixSchema(h);
  h = fixImages(h);
  h = reorder(h, 'meta', META_FIRST, ['content']);
  h = reorder(h, 'link', LINK_FIRST, []);
  h = fixStylesheets(h);
  return h;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

function main() {
  let changed = 0;
  const files = walk(ROOT);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const dst = processHtml(src);
    if (dst !== src) { fs.writeFileSync(f, dst); changed++; }
  }
  console.log(`postprocess-html: ${changed}/${files.length} HTML files updated`);
}

if (require.main === module) main();
module.exports = { processHtml };
