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
// No <link rel="stylesheet"> is left in the page, before or after rendering:
// each local stylesheet becomes an empty <style data-css="href"> placeholder
// (same position, so the cascade order is unchanged) plus a fetch preload.
// A tiny loader at the top of <body> fills the placeholders. The page stays
// hidden on the navy background until CSS is in (max 3s, pure CSS fallback),
// so there is no white or unstyled flash. Inline head scripts that don't need
// to run early (gtag config, Searchable stub) move to the end of <body>.
const CSS_GUARD = '<style id="css-guard">html{background:#05070d}body{opacity:0;animation:css-show 0s 3s forwards}' +
  '.css-ready body{opacity:1;animation:none}@keyframes css-show{to{opacity:1}}</style>' +
  '<noscript><style>body{opacity:1!important;animation:none!important}</style></noscript>';
const CSS_LOADER = '<script id="css-loader">(function(){var d=document,r=d.documentElement,' +
  's=d.querySelectorAll("style[data-css]"),n=s.length;function done(){if(--n<=0)r.classList.add("css-ready")}' +
  'if(!n){r.classList.add("css-ready");return}' +
  'Array.prototype.forEach.call(s,function(el){var h=el.getAttribute("data-css");' +
  'fetch(h).then(function(x){if(!x.ok)throw 0;return x.text()}).then(function(t){el.textContent=t;done()})' +
  '.catch(function(){var l=d.createElement("link");l.rel="stylesheet";l.href=h;l.onload=l.onerror=done;el.parentNode.insertBefore(l,el)})})})()</script>';
const LATE_SCRIPT_RE = /<script>\s*(window\.dataLayer=|window\.sa=)[\s\S]*?<\/script>\s*/g;

// undo the earlier preload/onload pattern so it can be replaced
function undoOldSwap(html) {
  if (!html.includes('id="css-swap"')) return html;
  let h = html.replace(/<style id="css-swap">[\s\S]*?<\/style>/, '');
  h = h.replace(/<script>document\.documentElement\.classList\.add\('css-wait'\)[\s\S]*?<\/script>/, '');
  h = h.replace(/<link\b[^>]*\bas="style"[^>]*>\s*<noscript>\s*(<link\b[^>]*>)\s*<\/noscript>/g, (_m, inner) => inner);
  return h;
}

function fixStylesheets(html) {
  let h = undoOldSwap(html);
  if (h.includes('id="css-loader"')) return h;
  const headEnd = h.search(/<\/head>/i);
  if (headEnd === -1) return h;
  let head = h.slice(0, headEnd);
  let rest = h.slice(headEnd);
  let first = true;
  let found = false;
  head = head.replace(TAG_RE('link'), (tag) => {
    const attrs = parseAttrs(tag, 'link');
    const rel = (getAttr(attrs, 'rel') || '').toLowerCase();
    const href = getAttr(attrs, 'href') || '';
    const media = getAttr(attrs, 'media');
    if (rel !== 'stylesheet' || !href.startsWith('/') || href.startsWith('//') || (media && media !== 'all')) return tag;
    found = true;
    const out = (first ? CSS_GUARD : '') +
      `<link rel="preload" as="fetch" href="${href}" crossorigin="anonymous">` +
      `<style data-css="${href}"></style>`;
    first = false;
    return out;
  });
  if (!found) return h;
  // move non-critical inline scripts out of <head>
  const late = [];
  head = head.replace(LATE_SCRIPT_RE, (m) => { late.push(m.trim()); return ''; });
  // loader right after <body ...>
  let bodyDone = false;
  rest = rest.replace(TAG_RE('body'), (tag) => { if (bodyDone) return tag; bodyDone = true; return tag + CSS_LOADER; });
  if (late.length) {
    const i = rest.toLowerCase().lastIndexOf('</body>');
    if (i !== -1) rest = rest.slice(0, i) + late.join('') + rest.slice(i);
    else rest += late.join('');
  }
  return head + rest;
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


function decode(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&rarr;/g, '\u2192').replace(/&times;/g, '\u00d7');
}
function textOf(fragment) {
  return decode(fragment.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function absUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith('/') ? SITE + u : '';
}
function faqFromBody(html) {
  const body = html.slice(Math.max(0, html.search(/<body\b/i)));
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = h2.exec(body))) {
    if (!/frequently asked|^\s*faqs?\s*$|preguntas frecuentes/i.test(textOf(m[1]))) continue;
    const after = body.slice(m.index + m[0].length);
    const stop = after.search(/<h2\b|<footer\b|<\/article>|<\/main>/i);
    const sec = stop === -1 ? after : after.slice(0, stop);
    const parts = sec.split(/<h3\b[^>]*>/i).slice(1);
    const qa = [];
    for (const part of parts) {
      const end = part.search(/<\/h3>/i);
      if (end === -1) continue;
      const q = textOf(part.slice(0, end));
      const a = textOf(part.slice(end + 5));
      if (q && a) qa.push([q, a]);
    }
    if (qa.length) return qa;
  }
  return [];
}
const SECTION_NAMES = { insights: 'Answers', videos: 'Answers' };
function breadcrumbsFor(canonical, html) {
  let u;
  try { u = new URL(canonical); } catch (e) { return []; }
  if (u.origin !== SITE) return [];
  const es = u.pathname === '/es' || u.pathname.startsWith('/es/');
  const home = es ? ['Inicio', SITE + '/es/'] : ['Home', SITE + '/'];
  const segs = u.pathname.replace(/^\/es(\/|$)/, '/').split('/').filter(Boolean);
  if (!segs.length) return [home];
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  let name = h1 ? textOf(h1[1]) : '';
  if (!name && titleTag) name = textOf(titleTag[1]).split(' | ')[0];
  const out = [home];
  if (segs.length > 1 && SECTION_NAMES[segs[0]]) out.push([SECTION_NAMES[segs[0]], SITE + '/insights']);
  out.push([name || segs[segs.length - 1], canonical]);
  return out;
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

  // Page facts read from the HTML itself
  const meta = (key) => {
    const re = new RegExp(`<meta\\b[^>]*(?:name|property)="${key}"[^>]*>`, 'i');
    const t = html.match(re);
    if (!t) return '';
    const c = t[0].match(/\scontent="([^"]*)"/i);
    return c ? decode(c[1]).trim() : '';
  };
  const canonical = (() => {
    const t = html.match(/<link\b[^>]*rel="canonical"[^>]*>/i);
    const c = t && t[0].match(/\shref="([^"]*)"/i);
    return c ? c[1] : '';
  })();
  const desc = meta('description') || meta('og:description');
  const ogImage = absUrl(meta('og:image'));
  const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html);
  const mark = (node) => { const b = blocks.find((x) => nodesOf(x.obj).includes(node)); if (b) b.changed = true; };

  // Article family: author with a name (parsers that don't follow @id refs
  // otherwise see an author with no Person), and an image.
  for (const n of all()) {
    if (!typesOf(n).some((t) => ARTICLE_TYPES.has(t))) continue;
    const a = n.author;
    if (a && !Array.isArray(a) && typeof a === 'object' && a['@id'] === PERSON_ID && !a.name) {
      n.author = { '@type': 'Person', '@id': PERSON_ID, 'name': 'Kevin Bovett', 'url': SITE + '/about' };
      mark(n);
    }
    if (!n.image && ogImage) { n.image = ogImage; mark(n); }
  }

  // WebPage family: description from the meta description
  const PAGE_TYPES = new Set(['WebPage', 'AboutPage', 'CollectionPage', 'ContactPage', 'ItemPage', 'ProfilePage']);
  for (const n of all()) {
    if (typesOf(n).some((t) => PAGE_TYPES.has(t)) && !n.description && desc) { n.description = desc; mark(n); }
  }

  // FAQPage from an on-page FAQ section (h2 "Frequently asked questions" + h3 questions)
  if (!hasTop((n) => typesOf(n).includes('FAQPage'))) {
    const qa = faqFromBody(html);
    if (qa.length >= 2) {
      const b = blocks[blocks.length - 1];
      b.obj = toGraph(b.obj);
      b.obj['@graph'].push({
        '@type': 'FAQPage',
        '@id': (canonical || SITE) + '#faq',
        'mainEntity': qa.map(([q, a]) => ({ '@type': 'Question', 'name': q, 'acceptedAnswer': { '@type': 'Answer', 'text': a } })),
      });
      b.changed = true;
    }
  }

  // BreadcrumbList on every indexable page that lacks one
  if (!noindex && canonical && !hasTop((n) => typesOf(n).includes('BreadcrumbList'))) {
    const crumbs = breadcrumbsFor(canonical, html);
    if (crumbs.length) {
      const b = blocks[blocks.length - 1];
      b.obj = toGraph(b.obj);
      b.obj['@graph'].push({
        '@type': 'BreadcrumbList',
        '@id': canonical + '#breadcrumb',
        'itemListElement': crumbs.map(([name, item], i) => ({ '@type': 'ListItem', 'position': i + 1, 'name': name, 'item': item })),
      });
      b.changed = true;
    }
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
