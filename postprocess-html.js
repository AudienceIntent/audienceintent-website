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
const PERSON_ID = SITE + '/about#kevin-bovett';
const ORG_ID = SITE + '/#organization';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'admin', 'ffp-social', 'netlify', 'fonts', 'images', '.netlify']);
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

const PERSON_SAME_AS = ['https://www.linkedin.com/in/kevinbovett/', 'https://www.crunchbase.com/person/kevin-bovett'];

const PERSON_NODE = {
  '@type': 'Person',
  '@id': PERSON_ID,
  'name': 'Kevin Bovett',
  'jobTitle': 'Founder & CEO',
  'url': SITE + '/about',
  'image': SITE + '/assets/img/kevin-bovett.jpg',
  'worksFor': { '@id': ORG_ID },
  'sameAs': PERSON_SAME_AS,
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
  // A homepage has no trail: the EN home gets none (a one-item list reads as
  // incomplete), the ES home sits one level under the EN home.
  if (!segs.length) return es ? [['Home', SITE + '/'], ['Español', SITE + '/es/']] : [];
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
      n.author = { '@type': 'Person', '@id': PERSON_ID, 'name': 'Kevin Bovett', 'url': SITE + '/about', 'sameAs': PERSON_SAME_AS };
      mark(n);
    }
    if (!n.image && ogImage) { n.image = ogImage; mark(n); }
  }

  // Kevin's Person node (wherever it appears): one @id, linked to his LinkedIn
  for (const n of all()) {
    if (n && n['@id'] === PERSON_ID && typesOf(n).includes('Person') && !n.sameAs) {
      n.sameAs = PERSON_SAME_AS; mark(n);
    }
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

  // One-item BreadcrumbLists are incomplete: rebuild them, or drop them
  // when the page has no trail (the EN homepage).
  for (const b of blocks) {
    const g = nodesOf(b.obj);
    const i = g.findIndex((n) => typesOf(n).includes('BreadcrumbList') && (!Array.isArray(n.itemListElement) || n.itemListElement.length < 2));
    if (i === -1 || !Array.isArray(b.obj['@graph'])) continue;
    b.obj['@graph'].splice(i, 1);
    b.changed = true;
  }

  // BreadcrumbList on every indexable page that lacks one
  if (!noindex && canonical && !hasTop((n) => typesOf(n).includes('BreadcrumbList'))) {
    const crumbs = breadcrumbsFor(canonical, html);
    if (crumbs.length >= 2) {
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
    // every block is written minified (whitespace in JSON-LD is markup weight)
    const repl = b.open + JSON.stringify(b.obj).replace(/<\//g, '<\\/') + b.close;
    if (repl === b.full) continue;
    out = out.slice(0, b.start) + repl + out.slice(b.start + b.full.length);
  }
  return out;
}


// 5. Content-to-code ratio: keep markup weight out of the HTML.
//    - repeated icon SVGs move to one cached sprite (<use href>), so the
//      page keeps only a short <svg><use></svg> per icon;
//    - large inline <style> blocks in <head> and large inline <script>s in
//      <body> move to content-hashed files under /assets/gen/;
//    - /assets/site.css and /assets/site.js get a content-hash ?v= so a CSS
//      change can never be served from a stale year-long cache.
// Generated files live in assets/gen/ (build output, git-ignored).
const crypto = require('crypto');
const GEN_DIR = 'assets/gen';
const SPRITE_TOKEN = '__AI_SPRITE__';
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

function newCtx() { return { symbols: new Map(), files: new Map() }; }

const ICON_TAGS = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'g']);
const ICON_ATTRS = new Set(['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'fill-rule', 'clip-rule', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'opacity', 'fill-opacity', 'stroke-opacity']);
const SVG_MIN = 300; // smaller icons are not worth a request-free <use>

// Is the inner markup a plain, static icon (no ids, classes, styles, text,
// gradients or animation) that renders the same inside a <use> shadow tree?
function plainIcon(inner) {
  const body = inner.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '');
  const tags = body.match(/<\/?[a-zA-Z][^>]*>/g) || [];
  if (!tags.length) return false;
  for (const t of tags) {
    const m = t.match(/^<\/?([a-zA-Z][\w-]*)/);
    if (!m || !ICON_TAGS.has(m[1].toLowerCase())) return false;
    if (t.startsWith('</')) continue;
    for (const [k] of parseAttrs(t.replace(/\/>$/, '>'), m[1])) {
      if (!ICON_ATTRS.has(k.toLowerCase())) return false;
    }
  }
  return body.replace(/<[^>]*>/g, '').trim() === '';
}

// Self-contained coloured icons (gradients, fixed fills, no currentColor):
// the drawing moves to its own cached .svg file shown through an SVG
// <image>, so the outer <svg> (and every CSS rule sizing it) stays as is.
const IMG_TAGS = new Set([...ICON_TAGS, 'defs', 'lineargradient', 'radialgradient', 'stop']);
const IMG_ATTRS = new Set([...ICON_ATTRS, 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy', 'xmlns']);
const XML_CASE = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', gradientunits: 'gradientUnits', gradienttransform: 'gradientTransform' };
function standaloneIcon(full, inner) {
  if (/currentcolor/i.test(full)) return false;
  const body = inner.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '');
  const tags = body.match(/<\/?[a-zA-Z][^>]*>/g) || [];
  if (!tags.length) return false;
  for (const t of tags) {
    const m = t.match(/^<\/?([a-zA-Z][\w-]*)/);
    if (!m || !IMG_TAGS.has(m[1].toLowerCase())) return false;
    if (t.startsWith('</')) continue;
    const attrs = parseAttrs(t.replace(/\/>$/, '>'), m[1]);
    for (const [k] of attrs) if (!IMG_ATTRS.has(k.toLowerCase())) return false;
    // every shape needs its own fill: inherited fills don't reach an <image>
    if (ICON_TAGS.has(m[1].toLowerCase()) && m[1].toLowerCase() !== 'g' && !getAttr(attrs, 'fill')) return false;
  }
  return body.replace(/<[^>]*>/g, '').trim() === '';
}

function spriteSvgs(html, ctx) {
  return html.replace(/<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/svg>/gi, (full, attrStr, inner) => {
    if (full.length < SVG_MIN || /<svg\b/i.test(inner)) return full;
    if (!plainIcon(inner)) {
      if (!standaloneIcon(full, inner)) return full;
      const attrs = parseAttrs('<svg' + attrStr + '>', 'svg');
      const vb = getAttr(attrs, 'viewbox');
      const dims = (vb || '').trim().split(/[\s,]+/).map(Number);
      if (dims.length !== 4 || dims.some(isNaN)) return full;
      const titleM = inner.match(/<title\b[^>]*>[\s\S]*?<\/title>/i);
      // XML is case-sensitive: restore names an HTML serializer lower-cased
      const shape = inner.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '').trim()
        .replace(/\b(lineargradient|radialgradient|gradientunits|gradienttransform)\b/gi, (w) => XML_CASE[w.toLowerCase()]);
      const file = genFile(ctx, 'svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${shape}</svg>\n`);
      const keep = attrs.filter(([k]) => k.toLowerCase() !== 'xmlns');
      return buildTag('svg', keep) + (titleM ? titleM[0] : '') +
        `<image href="${file}" x="${dims[0]}" y="${dims[1]}" width="${dims[2]}" height="${dims[3]}"></image></svg>`;
    }
    const attrs = parseAttrs('<svg' + attrStr + '>', 'svg');
    const vb = getAttr(attrs, 'viewbox');
    if (!vb) return full;
    const titleM = inner.match(/<title\b[^>]*>[\s\S]*?<\/title>/i);
    const shape = inner.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '').trim();
    const id = 'i' + hash(vb + '|' + shape);
    if (!ctx.symbols.has(id)) ctx.symbols.set(id, `<symbol id="${id}" viewBox="${vb}">${shape.replace(/(<(?:path|circle|rect|ellipse|line|polyline|polygon)\b[^>]*?)\s*>\s*<\/(?:path|circle|rect|ellipse|line|polyline|polygon)>/gi, '$1/>')}</symbol>`);
    const keep = attrs.filter(([k]) => k.toLowerCase() !== 'xmlns');
    return buildTag('svg', keep) + (titleM ? titleM[0] : '') + `<use href="${SPRITE_TOKEN}#${id}"></use></svg>`;
  });
}

function genFile(ctx, ext, text) {
  const name = `/${GEN_DIR}/${hash(text)}.${ext}`;
  ctx.files.set(name, text);
  return name;
}

function externalizeStyles(html, ctx) {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return html;
  let head = html.slice(0, headEnd);
  head = head.replace(/(<noscript\b[\s\S]*?<\/noscript>)|<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, ns, attrs, css) => {
    if (ns || /\b(data-css|id|media)\b/i.test(attrs || '') || css.length < 1000) return full;
    return `<link rel="stylesheet" href="${genFile(ctx, 'css', css.trim() + '\n')}">`;
  });
  return head + html.slice(headEnd);
}

function externalizeScripts(html, ctx) {
  const bodyStart = html.search(/<body\b/i);
  if (bodyStart === -1) return html;
  const body = html.slice(bodyStart).replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, js) => {
    if (/\b(src|id|type)\s*=/i.test(attrs) || js.length < 1500) return full;
    return `<script src="${genFile(ctx, 'js', js.trim() + '\n')}"${attrs}></script>`;
  });
  return html.slice(0, bodyStart) + body;
}

function versionAssets(html, ctx) {
  for (const [asset, v] of ctx.versions || []) {
    const re = new RegExp(asset.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(\\?v=[^"\'\\s>]*)?(?=["\'\\s>])', 'g');
    html = html.replace(re, asset + '?v=' + v);
  }
  return html;
}

// 6. Table of contents with anchor links for article and video pages
//    (any .art-body with 3+ h2s), placed just before the first h2.
function slug(t) {
  return t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'section';
}
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function addToc(html) {
  if (html.includes('class="toc')) return html;
  const open = html.match(/<div\b[^>]*class="art-body"[^>]*>/i);
  if (!open) return html;
  const start = open.index + open[0].length;
  // find the matching </div>
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 1, end = -1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (!depth) { end = m.index; break; }
  }
  if (end === -1) return html;
  let body = html.slice(start, end);
  const used = new Set((html.match(/\sid="([^"]+)"/g) || []).map((x) => x.slice(5, -1)));
  const items = [];
  body = body.replace(/<h2\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/h2>/gi, (full, attrs, inner) => {
    const text = textOf(inner);
    if (!text) return full;
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) {
      const base = slug(text);
      id = base;
      for (let i = 2; used.has(id); i++) id = base + '-' + i;
      used.add(id);
      attrs = ` id="${id}"` + attrs;
    }
    items.push([id, text]);
    return `<h2${attrs}>${inner}</h2>`;
  });
  if (items.length < 3) return html;
  const nav = `<nav class="toc${items.length > 5 ? ' toc-2' : ''}" aria-label="On this page"><p class="toc-h">On this page</p><ol>` +
    items.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('') + '</ol></nav>';
  const first = body.search(/<h2\b/i);
  body = body.slice(0, first) + nav + body.slice(first);
  return html.slice(0, start) + body + html.slice(end);
}

function processHtml(html, ctx) {
  const standalone = !ctx;
  ctx = ctx || newCtx();
  let h = html;
  h = addToc(h);
  h = fixSchema(h);
  h = fixImages(h);
  h = reorder(h, 'meta', META_FIRST, ['content']);
  h = reorder(h, 'link', LINK_FIRST, []);
  h = externalizeStyles(h, ctx);
  h = externalizeScripts(h, ctx);
  h = spriteSvgs(h, ctx);
  h = versionAssets(h, ctx);
  h = fixStylesheets(h);
  if (standalone) h = h.split(SPRITE_TOKEN).join('/' + GEN_DIR + '/icons.svg');
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
  const ctx = newCtx();
  ctx.versions = ['/assets/site.css', '/assets/site.js']
    .filter((a) => fs.existsSync(path.join(ROOT, a)))
    .map((a) => [a, hash(fs.readFileSync(path.join(ROOT, a), 'utf8'))]);
  const files = walk(ROOT);
  const out = files.map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    return [f, src, processHtml(src, ctx)];
  });
  // one icon sprite for the whole site, named by its content
  let spriteUrl = '';
  if (ctx.symbols.size) {
    const ids = [...ctx.symbols.keys()].sort();
    const sprite = '<svg xmlns="http://www.w3.org/2000/svg">' + ids.map((k) => ctx.symbols.get(k)).join('') + '</svg>\n';
    spriteUrl = genFile(ctx, 'svg', sprite);
  }
  if (ctx.files.size) fs.mkdirSync(path.join(ROOT, GEN_DIR), { recursive: true });
  for (const [name, text] of ctx.files) fs.writeFileSync(path.join(ROOT, name), text);
  let changed = 0;
  for (const [f, src, dst0] of out) {
    const dst = dst0.split(SPRITE_TOKEN).join(spriteUrl);
    if (dst !== src) { fs.writeFileSync(f, dst); changed++; }
  }
  console.log(`postprocess-html: ${changed}/${files.length} HTML files updated, ${ctx.symbols.size} icons in sprite, ${ctx.files.size} generated assets`);
}

if (require.main === module) main();
module.exports = { processHtml, addToc };
