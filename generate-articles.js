// ============================================================
// generate-articles.js — AudienceIntent
// Netlify build script
// Generates: articles.json, articles-data.js, sitemap.xml, sitemap-images.xml
// Updated: June 2026
//
// CHANGES THIS REVISION:
//   • IMAGE PATH FIX (images always resolve):
//       - normalizeImagePath()  → forces leading slash on
//         relative paths so root-relative <img>/cards/JSON work
//         on nested /insights/<slug>/ URLs (Decap saves media
//         picks WITHOUT a leading slash, which broke previews).
//       - toAbsoluteUrl()       → full https:// URL for og:image,
//         twitter:image, schema image, and image sitemap, since
//         LinkedIn/Facebook/iMessage scrapers reject root-relative.
//       - Applied to: frontmatter image + og_image, inline body
//         <img> tags in markdownToHtml, schema, social tags,
//         and both sitemaps.
//
// PRIOR REVISION:
//   • SEO audit tightened to checklist targets:
//       - title         50–60 chars
//       - description  120–140 chars
//   • Auto-fill of missing fields (Issue B fix):
//       - meta_title    → derived from title (truncated to 60)
//       - updated_at    → falls back to date
//       - focus_keyword → derived from title (stop-words stripped)
//       - schema        → auto-generated Article + BreadcrumbList JSON-LD
//   • Smart description handling (Option B):
//       - In-range (120–140) descriptions kept as-is
//       - Over-140 descriptions smart-truncated at sentence,
//         then clause, then word boundary (never mid-word)
//       - Missing / too-short descriptions auto-generated from
//         the article body's first meaningful paragraph,
//         then trimmed to the 120–140 target band
//   • Dead Google/Bing sitemap pings removed (both deprecated 2023).
//     Replaced with IndexNow stub + Search Console guidance.
// ============================================================

const fs   = require('fs');
const path = require('path');

const INSIGHTS_DIR       = path.join(__dirname, 'insights');
const OUTPUT_FILE        = path.join(__dirname, 'articles.json');
const OUTPUT_JS_FILE     = path.join(__dirname, 'articles-data.js');
const SITEMAP_FILE       = path.join(__dirname, 'sitemap.xml');
const SITEMAP_IMG_FILE   = path.join(__dirname, 'sitemap-images.xml');
const SITE_URL           = 'https://www.audienceintent.ai';
const LOGO_URL           = SITE_URL + '/images/uploads/audienceintent-logo.png';
// Fallback image used when an article still points at the retired
// Framer CDN (framerusercontent.com). Lets the site cancel Framer
// without every article showing a broken hero/social image.
const PLACEHOLDER_IMAGE  = '/images/uploads/SocialShareJPEG.jpg';

// Rewrites any framerusercontent.com image URL to the placeholder.
// Returns other values untouched. Applied to article image +
// og_image at parse time, so JSON data, schema, social tags, the
// inline hero, and the image sitemap all inherit the clean path.
function stripFramerImage(p) {
  if (!p) return p;
  return /framerusercontent\.com/i.test(String(p)) ? PLACEHOLDER_IMAGE : p;
}
const ORG_ID             = SITE_URL + '/#organization';

// Today's date in ISO format for sitemap lastmod on static pages
const TODAY = new Date().toISOString().split('T')[0];

// Stop words used when auto-deriving a focus_keyword from a title.
const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','been','but','by','can','could',
  'did','do','does','for','from','had','has','have','if','in','is','it',
  'its','may','might','more','most','must','my','of','on','or','our',
  'shall','should','some','that','the','this','to','was','we','were',
  'will','with','would','you','your','any','all'
]);

// ============================================================
// IMAGE PATH NORMALISATION
// Decap saves media-library picks as relative paths
// (e.g. "images/uploads/foo.jpg" — no leading slash). Those
// resolve fine in the CMS preview but break on nested article
// URLs like /insights/<slug>/ where the browser resolves them
// against the slug dir instead of the site root. We force a
// leading slash for on-page use, and a full https:// URL for
// social/OG tags and sitemaps (LinkedIn/Facebook/iMessage
// scrapers reject root-relative og:image values).
// ============================================================

// Root-absolute path for in-page <img src> and JSON data.
// "images/uploads/x.jpg"  → "/images/uploads/x.jpg"
// "/images/uploads/x.jpg" → unchanged
// "https://cdn/x.jpg"     → unchanged (external / full URL)
// "//cdn/x.jpg"           → unchanged (protocol-relative)
function normalizeImagePath(p) {
  if (!p) return '';
  p = String(p).trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p; // already absolute URL
  if (/^\/\//.test(p))         return p; // protocol-relative
  if (/^(data|blob):/i.test(p)) return p; // inline data URIs
  return p.startsWith('/') ? p : '/' + p;
}

// Full https:// URL for og:image, twitter:image, schema, sitemaps.
function toAbsoluteUrl(p) {
  if (!p) return '';
  p = String(p).trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;          // already full URL
  if (/^\/\//.test(p))         return 'https:' + p; // protocol-relative
  if (/^(data|blob):/i.test(p)) return p;          // can't absolutise
  return SITE_URL + (p.startsWith('/') ? p : '/' + p);
}

// ============================================================
// MARKDOWN → HTML CONVERTER
// ============================================================
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Remove leading image line (already captured as featured image)
  html = html.replace(/^!\[.*?\]\([^\)]+\)\s*\n?/m, '');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm,  '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm,   '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm,    '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm,     '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm,      '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,          '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,255,115,0.08);color:#00ff73;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>');

  // Blockquotes — group all consecutive > lines into one block,
  // then convert inner list items and paragraphs properly.
  html = html.replace(/((?:^>[ \t]?.*\n?)+)/gm, function(block) {
    // Strip the leading > from every line
    var inner = block.replace(/^>[ \t]?/gm, '').trimEnd();

    // Convert inner list items (- or * or +) to <li> wrapped in <ul>
    inner = inner.replace(/((?:^[-*+]\s+.+\n?)+)/gm, function(listBlock) {
      var items = listBlock.trim().split('\n').map(function(line) {
        return '<li>' + line.replace(/^[-*+]\s+/, '') + '</li>';
      }).join('');
      return '<ul>' + items + '</ul>';
    });

    // Wrap remaining non-tag lines in <p>
    inner = inner.split('\n').map(function(line) {
      line = line.trim();
      if (!line) return '';
      if (/^</.test(line)) return line;
      return '<p>' + line + '</p>';
    }).filter(Boolean).join('\n');

    return '<blockquote>' + inner + '</blockquote>\n';
  });

  // Images and links
  // Inline body images: normalise the src so relative paths
  // (Decap default) resolve from the site root on nested URLs.
  html = html.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, function(_match, alt, src) {
    var safeSrc = normalizeImagePath(stripFramerImage(src.trim()));
    var safeAlt = (alt || '').trim();
    return '<img src="' + safeSrc + '" alt="' + safeAlt + '" title="' + safeAlt +
           '" loading="lazy" style="max-width:100%;border-radius:8px;margin:16px 0;">';
  });
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g,  '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Unordered lists
  html = html.replace(/((?:^[-*+]\s+.+\n?)+)/gm, function(block) {
    var items = block.trim().split('\n').map(function(line) {
      return '<li>' + line.replace(/^[-*+]\s+/, '') + '</li>';
    }).join('');
    return '<ul>' + items + '</ul>\n';
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, function(block) {
    var items = block.trim().split('\n').map(function(line) {
      return '<li>' + line.replace(/^\d+\.\s+/, '') + '</li>';
    }).join('');
    return '<ol>' + items + '</ol>\n';
  });

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr style="border:none;border-top:1px solid rgba(248,247,246,0.12);margin:32px 0">');

  // Tables
  html = html.replace(/((?:^[^\n]*\|[^\n]*\n?)+)/gm, function(block) {
    const lines = block.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return block;
    const isSeparator = /^[\s|:\-]+$/.test(lines[1]);
    if (!isSeparator) return block;
    const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean);
    const thead = '<thead><tr>' + headerCells.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>';
    const bodyRows = lines.slice(2).map(function(line) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      return '<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table>' + thead + '<tbody>' + bodyRows + '</tbody></table></div>\n';
  });

  // Paragraphs
  const blockTags = /^(<h[1-6]|<ul|<ol|<li|<blockquote|<hr|<img|<div|<\/)/;
  html = html.split('\n\n').map(function(chunk) {
    chunk = chunk.trim();
    if (!chunk) return '';
    if (blockTags.test(chunk)) return chunk;
    chunk = chunk.replace(/\n/g, ' ');
    return '<p>' + chunk + '</p>';
  }).filter(Boolean).join('\n');

  return html;
}

// ============================================================
// READING TIME CALCULATOR
// Average adult reads ~200 words per minute
// ============================================================
function calculateReadTime(content, bodyText) {
  const text = (bodyText || content || '').replace(/<[^>]+>/g, ' ');
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(wordCount / 200);
  return Math.max(1, minutes);
}

// ============================================================
// AUTO-FILL HELPERS (Issue B fix)
// Produce sensible defaults for fields missing in frontmatter.
// ============================================================

// meta_title: keep title if ≤ 60 chars, else truncate at the
// last word boundary within 60 chars (avoids ugly mid-word cuts).
function deriveMetaTitle(title) {
  if (!title) return '';
  if (title.length <= 60) return title;
  const trimmed = title.substring(0, 60);
  return trimmed.replace(/\s+\S*$/, '').trim();
}

// focus_keyword: extract the 2–3 most meaningful words from the
// title (strip stop words, punctuation, short tokens).
function deriveFocusKeyword(title) {
  if (!title) return '';
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(' ');
}

// Word count from HTML content, for schema enrichment.
function countWords(html) {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── DESCRIPTION HANDLING (Option B) ──────────────────────────
// Target band: 120–140 chars. The helpers below progressively
// try sentence → clause → word boundary so descriptions never
// terminate mid-word like the old "...better pro" / "...the foll"
// outputs from previous build scripts.
const DESC_TARGET_MIN = 120;
const DESC_TARGET_MAX = 140;
const DESC_HARD_MAX   = 140;     // never exceed this
const ELLIPSIS        = '…';     // single-char ellipsis (1 char, not 3)

// Smart-truncate a description to ≤ DESC_HARD_MAX chars.
// Preference order:
//   1. End at the nearest sentence break ≤ max
//   2. End at the nearest clause break (comma / semicolon / em-dash)
//   3. End at the nearest word boundary, append ellipsis
// Already in-range strings are returned untouched.
function smartTruncateDescription(text) {
  if (!text) return '';
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= DESC_HARD_MAX) return text;

  // Reserve 1 char for the ellipsis when we have to fall back to it
  const hardCut = text.substring(0, DESC_HARD_MAX);

  // (1) Sentence boundary: last . ! ? not in an abbreviation
  // Look for terminal punctuation followed by space or end-of-string.
  const sentenceMatch = hardCut.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentenceMatch) {
    const sentence = sentenceMatch[0].trim();
    if (sentence.length >= DESC_TARGET_MIN) return sentence;
  }

  // (2) Clause boundary: last , ; or em-dash inside the cut
  const clauseEnd = Math.max(
    hardCut.lastIndexOf(','),
    hardCut.lastIndexOf(';'),
    hardCut.lastIndexOf('—'),
    hardCut.lastIndexOf(' – ')
  );
  if (clauseEnd >= DESC_TARGET_MIN) {
    return hardCut.substring(0, clauseEnd).trim() + ELLIPSIS;
  }

  // (3) Word boundary: cut on the last space before max-1 (room for …)
  const safe = text.substring(0, DESC_HARD_MAX - 1);
  const lastSpace = safe.lastIndexOf(' ');
  if (lastSpace > 0) {
    return safe.substring(0, lastSpace).trim() + ELLIPSIS;
  }

  // Final fallback — single long token, just hard-cut and ellipsise
  return safe + ELLIPSIS;
}

// Pull a description-worthy paragraph from rendered HTML body.
// Strips HTML, joins paragraphs with spaces, then smart-truncates.
// Used when frontmatter has no description (or one too short).
function extractBodyDescription(html) {
  if (!html) return '';

  // Pull text from the first meaningful <p> tags only —
  // headings/lists/tables don't make good descriptions.
  const paragraphs = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  let textPool = '';
  while ((m = re.exec(html)) !== null) {
    const txt = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (txt.length < 20) continue; // skip short fragments (image captions, etc.)
    paragraphs.push(txt);
    textPool = paragraphs.join(' ');
    // Stop once we have enough material to truncate from
    if (textPool.length >= 220) break;
  }

  if (!textPool) {
    // Fallback: strip ALL tags from the body
    textPool = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return smartTruncateDescription(textPool);
}

// Normalise a description: clean whitespace, decode common HTML
// entities that may have leaked in from markdown ampersand escaping.
function normaliseDescription(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Auto-generated JSON-LD: Article + BreadcrumbList in a single
// @graph. Returns a stringified JSON-LD ready to drop into a
// <script type="application/ld+json"> tag.
function generateAutoSchema(article) {
  const canonical = article.canonical || `${SITE_URL}/insights/${article.slug}`;
  // Schema image must be an absolute URL for Google rich results.
  const articleImage = toAbsoluteUrl(article.og_image || article.image) || LOGO_URL;
  const datePublished = article.date;
  const dateModified  = article.updated_at || article.date;

  const graph = [
    {
      "@type": "Article",
      "@id": canonical + "#article",
      "headline": article.title,
      "description": article.description || article.excerpt,
      "image": articleImage,
      "datePublished": datePublished,
      "dateModified": dateModified,
      "author": {
        "@type": "Person",
        "name": article.author || "Kevin Bovett",
        "url": SITE_URL + "/about"
      },
      "publisher": {
        "@type": "Organization",
        "@id": ORG_ID,
        "name": "AudienceIntent",
        "logo": {
          "@type": "ImageObject",
          "url": LOGO_URL,
          "width": 512,
          "height": 512
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonical
      },
      "articleSection": article.category || "Insights",
      "keywords": article.focus_keyword || "",
      "wordCount": countWords(article.content),
      "inLanguage": "en-US"
    },
    {
      "@type": "BreadcrumbList",
      "@id": canonical + "#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home",     "item": SITE_URL + "/" },
        { "@type": "ListItem", "position": 2, "name": "Insights", "item": SITE_URL + "/insights" },
        { "@type": "ListItem", "position": 3, "name": article.title, "item": canonical }
      ]
    }
  ];

  const schemaObj = {
    "@context": "https://schema.org",
    "@graph": graph
  };

  return JSON.stringify(schemaObj, null, 2);
}

// ============================================================
// FRONTMATTER PARSER
// ============================================================
function parseFrontmatter(text, filename) {
  const result = {
    slug:          filename.replace('.md', ''),
    title:         '',
    date:          '',
    updated_at:    '',
    category:      '',
    excerpt:       '',
    description:   '',
    image:         '',
    meta_title:    '',
    focus_keyword: '',
    canonical:     '',
    og_image:      '',
    author:        'Kevin Bovett',
    schema:        '',
    read_time:     0,
    content:       '',
    _auto_filled:  []   // internal flag list, stripped before serialize
  };

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.log('  WARNING: No frontmatter in ' + filename);
    result.content   = markdownToHtml(text);
    result.read_time = calculateReadTime(result.content);
    return result;
  }

  const fm   = fmMatch[1];
  const body = text.slice(fmMatch[0].length).trim();

  // ── Title ──
  let tm = fm.match(/^title:\s*"((?:[^"\\]|\\.)*)"/m);
  if (tm) { result.title = tm[1].trim(); }
  else {
    tm = fm.match(/^title:\s*'((?:[^'\\]|\\.)*)'/m);
    if (tm) { result.title = tm[1].trim(); }
    else {
      tm = fm.match(/^title:\s*([\s\S]*?)(?=\n\w)/m);
      if (tm) { result.title = tm[1].replace(/\n\s+/g, ' ').trim(); }
    }
  }

  // ── Published date ──
  const dm = fm.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (dm) { result.date = dm[1]; }

  // ── Updated date ──
  const um = fm.match(/^updated_at:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (um) { result.updated_at = um[1]; }
  if (!result.updated_at) {
    const lm = fm.match(/^last_modified:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
    if (lm) { result.updated_at = lm[1]; }
  }

  // ── Category ──
  const cm = fm.match(/^category:\s*"?([^"\n]+)"?\s*$/m);
  if (cm) { result.category = cm[1].trim().replace(/^"|"$/g, ''); }

  // ── Image ──
  const im = fm.match(/^image:\s*"?([^"\n]+)"?\s*$/m);
  if (im) {
    result.image = im[1].trim().replace(/^"|"$/g, '');
  } else {
    const bm = body.match(/!\[.*?\]\(([^\s)"]+)/);
    if (bm) { result.image = bm[1]; }
  }

  // ── Description / excerpt ──
  let dem = fm.match(/^description:\s*"((?:[^"\\]|\\.)*)"/m);
  if (dem) {
    result.excerpt     = dem[1].trim();
    result.description = dem[1].trim();
  } else {
    dem = fm.match(/^description:\s*'((?:[^'\\]|\\.)*)'/m);
    if (dem) {
      result.excerpt     = dem[1].trim();
      result.description = dem[1].trim();
    } else {
      dem = fm.match(/^description:\s*(.+(?:\n[ \t]+.+)*)/m);
      if (dem) {
        const clean = dem[1].replace(/\n[ \t]+/g, ' ').trim().replace(/^"|"$/g, '');
        result.excerpt     = clean;
        result.description = clean;
      }
    }
  }

  // ── Meta title ──
  const mtm = fm.match(/^meta_title:\s*"?([^"\n]+)"?\s*$/m);
  if (mtm) { result.meta_title = mtm[1].trim().replace(/^"|"$/g, ''); }

  // ── Focus keyword ──
  const fkm = fm.match(/^focus_keyword:\s*"?([^"\n]+)"?\s*$/m);
  if (fkm) { result.focus_keyword = fkm[1].trim().replace(/^"|"$/g, ''); }

  // ── Canonical ──
  const canm = fm.match(/^canonical:\s*"?([^"\n]+)"?\s*$/m);
  if (canm) { result.canonical = canm[1].trim().replace(/^"|"$/g, ''); }

  // ── OG Image ──
  const ogm = fm.match(/^og_image:\s*"?([^"\n]+)"?\s*$/m);
  if (ogm) { result.og_image = ogm[1].trim().replace(/^"|"$/g, ''); }

  // ── Strip retired Framer CDN URLs → placeholder ──
  // Must run before normalizeImagePath so the result flows into
  // the hero img, JSON data, schema, social tags, and sitemaps.
  result.image    = stripFramerImage(result.image);
  result.og_image = stripFramerImage(result.og_image);

  // ── Normalise image paths (force leading slash) ──
  // Runs before content render + auto-fill so the inline hero,
  // JSON data, schema, and social tags all inherit the corrected
  // root-absolute path. Fixes Decap saving "images/uploads/x.jpg"
  // without a leading slash, which broke nested /insights/<slug>/.
  result.image    = normalizeImagePath(result.image);
  result.og_image = normalizeImagePath(result.og_image);

  // ── Author ──
  const autm = fm.match(/^author:\s*"?([^"\n]+)"?\s*$/m);
  if (autm) { result.author = autm[1].trim().replace(/^"|"$/g, ''); }

  // ── Schema (from frontmatter) ──
  const schm = fm.match(/^schema:\s*"((?:[^"\\]|\\[\s\S])*)"/m);
  if (schm) { result.schema = schm[1].trim(); }
  else {
    const schm2 = fm.match(/^schema:\s*'((?:[^'\\]|\\[\s\S])*)'/m);
    if (schm2) { result.schema = schm2[1].trim(); }
    else {
      const schm3 = fm.match(/^schema:\s*(.+(?:\n[ \t]+.+)*)/m);
      if (schm3) { result.schema = schm3[1].replace(/\n[ \t]+/g, ' ').trim(); }
    }
  }

  // ── Content + read time ──
  result.content   = markdownToHtml(body);
  result.read_time = calculateReadTime(result.content);

  // ──────────────────────────────────────────────────────────
  // AUTO-FILL MISSING FIELDS (Issue B fix)
  // Runs after all explicit frontmatter parsing so explicit
  // values always win.
  // ──────────────────────────────────────────────────────────

  // Canonical: required for schema, always derive if missing.
  if (!result.canonical && result.slug) {
    result.canonical = `${SITE_URL}/insights/${result.slug}`;
    result._auto_filled.push('canonical');
  }

  // updated_at → date (so dateModified is always present)
  if (!result.updated_at && result.date) {
    result.updated_at = result.date;
    result._auto_filled.push('updated_at');
  }

  // meta_title → title (truncated to 60 if needed)
  if (!result.meta_title && result.title) {
    result.meta_title = deriveMetaTitle(result.title);
    result._auto_filled.push('meta_title');
  }

  // focus_keyword → from title
  if (!result.focus_keyword && result.title) {
    result.focus_keyword = deriveFocusKeyword(result.title);
    result._auto_filled.push('focus_keyword');
  }

  // ── Description handling (Option B) ──────────────────────
  // Three cases:
  //   1. Has description in target band → normalise only, keep
  //   2. Description present but too long → smart-truncate
  //   3. Description missing or too short → derive from body
  //
  // Always normalise (strip leaked entities, collapse whitespace)
  // before measuring length so we don't mis-count escaped chars.
  const originalDesc = normaliseDescription(result.description || result.excerpt);

  if (!originalDesc) {
    // Case 3a: nothing in frontmatter — pull from body
    const derived = extractBodyDescription(result.content);
    if (derived) {
      result.description = derived;
      result.excerpt     = derived;
      result._auto_filled.push('description (derived from body)');
    }
  } else if (originalDesc.length > DESC_HARD_MAX) {
    // Case 2: too long — smart-truncate
    const trimmed = smartTruncateDescription(originalDesc);
    result.description = trimmed;
    result.excerpt     = trimmed;
    result._auto_filled.push(`description (truncated ${originalDesc.length}→${trimmed.length})`);
  } else if (originalDesc.length < DESC_TARGET_MIN) {
    // Case 3b: too short — try to extend from body, but only if
    // the body gives us a meaningfully better result. We do NOT
    // fabricate content; we just join the frontmatter description
    // with body content and re-truncate to the target band.
    const fromBody = extractBodyDescription(result.content);
    if (fromBody && fromBody.length >= DESC_TARGET_MIN) {
      result.description = fromBody;
      result.excerpt     = fromBody;
      result._auto_filled.push(`description (replaced ${originalDesc.length}-char with ${fromBody.length}-char from body)`);
    } else {
      // Keep the short original — better to under-spec than fabricate
      result.description = originalDesc;
      result.excerpt     = originalDesc;
    }
  } else {
    // Case 1: in target band — just normalise
    result.description = originalDesc;
    result.excerpt     = originalDesc;
  }

  // schema → auto-generated Article + BreadcrumbList JSON-LD
  // Only auto-generate if frontmatter didn't provide one.
  // Runs LAST so it picks up the corrected description above.
  if (!result.schema && result.title && result.date) {
    result.schema = generateAutoSchema(result);
    result._auto_filled.push('schema');
  }

  return result;
}

// ============================================================
// SEO AUDIT — logged at build time
// Tightened to checklist targets: title 50–60, description 120–140.
// ============================================================
function auditArticle(article) {
  const warnings = [];
  const titleToCheck = article.meta_title || article.title;
  const descToCheck  = article.description || article.excerpt;

  // ── Title length: aim 50–60 ──
  if (!titleToCheck) {
    warnings.push('MISSING title');
  } else if (titleToCheck.length < 50) {
    warnings.push(`SEO: title too short (${titleToCheck.length} chars, aim 50-60)`);
  } else if (titleToCheck.length > 60) {
    warnings.push(`SEO: title too long (${titleToCheck.length} chars, aim 50-60)`);
  }

  // ── Description length: aim 120–140 ──
  if (!descToCheck) {
    warnings.push('MISSING description');
  } else if (descToCheck.length < 120) {
    warnings.push(`SEO: description too short (${descToCheck.length} chars, aim 120-140)`);
  } else if (descToCheck.length > 140) {
    warnings.push(`SEO: description too long (${descToCheck.length} chars, aim 120-140)`);
  }

  if (!article.image) {
    warnings.push('SEO: no featured image');
  }

  if (!article.og_image && !article.image) {
    warnings.push('SEO: no og_image — social shares will use fallback');
  }

  return warnings;
}

// ============================================================
// SITEMAP GENERATOR
// ============================================================
function generateSitemap(articles) {
  const staticPages = [
    { url: '/',         priority: '1.0', changefreq: 'weekly',  lastmod: TODAY },
    { url: '/insights', priority: '0.9', changefreq: 'daily',   lastmod: TODAY },
    { url: '/legal',    priority: '0.4', changefreq: 'monthly', lastmod: TODAY },
  ];

  const staticUrls = staticPages.map(page => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');

  const articleUrls = articles.map(article => {
    const lastmod = article.updated_at || article.date || TODAY;
    return `  <url>
    <loc>${SITE_URL}/insights/${article.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
</urlset>`;
}

// ============================================================
// PER-ARTICLE STATIC HTML (fixes social share previews)
// LinkedIn / Facebook / X / iMessage do NOT run JavaScript, so
// JS-updated OG tags are never seen — they only get the static
// homepage defaults baked into article.html. This generator reads
// article.html as a template and stamps per-article meta into the
// head, writing one real file per slug at /insights/<slug>/index.html.
// ============================================================
const TEMPLATE_FILE = path.join(__dirname, 'article.html');

// HTML-escape a value destined for an attribute (content="...").
function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generatePageHtml(template, article) {
  const canonical = article.canonical || `${SITE_URL}/insights/${article.slug}`;
  const metaTitle = article.meta_title || article.title;
  const desc      = normaliseDescription(article.description || article.excerpt || '');
  // OG / Twitter image MUST be a full https:// URL — social
  // scrapers (LinkedIn/Facebook/iMessage) reject root-relative.
  const ogImage   = toAbsoluteUrl(article.og_image || article.image) || LOGO_URL;
  const published = article.date || '';
  const modified  = article.updated_at || article.date || '';
  const author    = article.author || 'Kevin Bovett';
  const section   = article.category || 'Insights';

  let html = template;

  // <title id="page-title">
  html = html.replace(
    /<title id="page-title">[\s\S]*?<\/title>/,
    `<title id="page-title">${escAttr(metaTitle)}</title>`
  );

  // Replace the content="" of a <meta id="..."> tag, regardless of
  // attribute order (handles both name="" and property="" tags).
  const setById = (id, value) => {
    const re = new RegExp(`(<meta id="${id}"[^>]*?\\bcontent=")[^"]*(")`);
    html = html.replace(re, `$1${escAttr(value)}$2`);
  };

  setById('page-desc', desc);
  setById('og-title', metaTitle);
  setById('og-desc', desc);
  setById('og-image', ogImage);
  setById('og-url', canonical);
  setById('og-published', published);
  setById('og-modified', modified);
  setById('og-author', author);
  setById('og-section', section);
  setById('tw-title', metaTitle);
  setById('tw-desc', desc);
  setById('tw-image', ogImage);

  // canonical <link id="page-canonical">
  html = html.replace(
    /(<link id="page-canonical" rel="canonical" href=")[^"]*(")/,
    `$1${escAttr(canonical)}$2`
  );

  // Bake the Article + BreadcrumbList JSON-LD into the static
  // <script id="page-schema"> so crawlers without JS get it too.
  const schema = article.schema && article.schema.trim()
    ? article.schema
    : generateAutoSchema(article);
  html = html.replace(
    /(<script type="application\/ld\+json" id="page-schema">)[\s\S]*?(<\/script>)/,
    `$1\n${schema}\n$2`
  );

  return html;
}

// ============================================================
// IMAGE SITEMAP GENERATOR
// Referenced in robots.txt as sitemap-images.xml
// ============================================================
function generateImageSitemap(articles) {
  const articlesWithImages = articles.filter(a => a.og_image || a.image);

  if (articlesWithImages.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
</urlset>`;
  }

  const urls = articlesWithImages.map(article => {
    // Image sitemap entries must be absolute URLs.
    const imgSrc = toAbsoluteUrl(article.og_image || article.image);
    const imgTitle = (article.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `  <url>
    <loc>${SITE_URL}/insights/${article.slug}</loc>
    <image:image>
      <image:loc>${imgSrc}</image:loc>
      <image:title>${imgTitle}</image:title>
      <image:caption>${(article.excerpt || article.description || '').substring(0, 200).replace(/&/g, '&amp;')}</image:caption>
    </image:image>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;
}

// ============================================================
// SEARCH ENGINE NOTIFICATION
// Google deprecated their sitemap ping endpoint in 2023.
// Bing deprecated theirs the same year.
// Modern replacement: IndexNow (Bing/Yandex/Naver/etc).
//
// To enable IndexNow:
//   1. Generate a key at https://www.bing.com/indexnow
//   2. Save key file at /<key>.txt at site root
//   3. Set INDEXNOW_KEY below and uncomment the call
// ============================================================
const INDEXNOW_KEY = ''; // e.g. 'abcdef1234567890abcdef1234567890'

async function notifyIndexNow(articles) {
  if (!INDEXNOW_KEY) {
    console.log('  INDEXNOW: skipped (no key set — see notifyIndexNow() comment)');
    return;
  }

  // Submit up to 100 URLs (older articles indexed already, ping recent only).
  const recentUrls = articles
    .slice(0, 100)
    .map(a => `${SITE_URL}/insights/${a.slug}`);

  const payload = {
    host: 'www.audienceintent.ai',
    key:  INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: recentUrls
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    console.log(`  INDEXNOW: ${res.status === 200 || res.status === 202 ? 'OK' : 'status ' + res.status} (${recentUrls.length} URLs)`);
  } catch (e) {
    console.log(`  INDEXNOW: failed (${e.message})`);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('='.repeat(56));
  console.log('AudienceIntent — Article Build Script');
  console.log('='.repeat(56));

  try {
    if (!fs.existsSync(INSIGHTS_DIR)) {
      console.log('ERROR: /insights directory not found — writing empty articles.json');
      fs.writeFileSync(OUTPUT_FILE, '[]');
      process.exit(0);
    }

    const files = fs.readdirSync(INSIGHTS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'index.md')
      .sort();

    console.log(`\nFound ${files.length} markdown file${files.length !== 1 ? 's' : ''} in /insights\n`);

    const articles = [];
    let totalWarnings = 0;
    let totalAutofills = 0;

    files.forEach(filename => {
      try {
        console.log(`Parsing: ${filename}`);
        const text   = fs.readFileSync(path.join(INSIGHTS_DIR, filename), 'utf8');
        const parsed = parseFrontmatter(text, filename);

        if (!parsed.title || !parsed.date) {
          console.log('  SKIP: missing title or date\n');
          return;
        }

        console.log(`  title:      ${parsed.title.substring(0, 55)}${parsed.title.length > 55 ? '...' : ''}`);
        console.log(`  date:       ${parsed.date}${parsed.updated_at && parsed.updated_at !== parsed.date ? ' (updated: ' + parsed.updated_at + ')' : ''}`);
        console.log(`  author:     ${parsed.author}`);
        console.log(`  category:   ${parsed.category || '—'}`);
        console.log(`  read_time:  ${parsed.read_time} min`);
        console.log(`  image:      ${parsed.image ? '✓ ' + parsed.image : '✗ NONE'}`);
        console.log(`  og_image:   ${parsed.og_image ? '✓ ' + parsed.og_image : '— (falls back to image)'}`);
        console.log(`  desc chars: ${(parsed.description || parsed.excerpt || '').length}`);

        // Auto-fill log (informational, not warnings)
        if (parsed._auto_filled && parsed._auto_filled.length > 0) {
          console.log(`  ℹ  auto-filled: ${parsed._auto_filled.join(', ')}`);
          totalAutofills += parsed._auto_filled.length;
        }

        // SEO audit
        const warnings = auditArticle(parsed);
        if (warnings.length > 0) {
          warnings.forEach(w => console.log(`  ⚠  ${w}`));
          totalWarnings += warnings.length;
        } else {
          console.log(`  ✓  SEO checks passed`);
        }

        articles.push(parsed);
        console.log('');
      } catch(e) {
        console.log(`  ERROR parsing ${filename}: ${e.message}\n`);
      }
    });

    // Sort newest first
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Strip internal flags before serialising
    const cleanArticles = articles.map(a => {
      const { _auto_filled, ...clean } = a;
      return clean;
    });

    // Write articles.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleanArticles, null, 2));
    console.log(`SUCCESS: articles.json — ${cleanArticles.length} article${cleanArticles.length !== 1 ? 's' : ''}`);

    // Write articles-data.js — listing format (no schema, no full content)
    const listingArticles = cleanArticles.map(a => ({
      slug:          a.slug,
      title:         a.title,
      date:          a.date,
      updated_at:    a.updated_at || '',
      category:      a.category,
      excerpt:       a.excerpt,
      description:   a.description,
      image:         a.image,
      image_alt:     a.image_alt || a.title || '',
      og_image:      a.og_image || a.image || '',
      author:        a.author,
      read_time:     a.read_time,
      meta_title:    a.meta_title || '',
      focus_keyword: a.focus_keyword || '',
      canonical:     a.canonical || (`${SITE_URL}/insights/${a.slug}`),
      review_needed: false,
    }));
    fs.writeFileSync(OUTPUT_JS_FILE, 'var ARTICLES = ' + JSON.stringify(listingArticles, null, 2) + ';');
    console.log(`SUCCESS: articles-data.js — ${listingArticles.length} articles (listing format)`);

    // Write sitemap.xml
    const sitemap = generateSitemap(cleanArticles);
    fs.writeFileSync(SITEMAP_FILE, sitemap);
    console.log(`SUCCESS: sitemap.xml — ${cleanArticles.length + 3} URLs (3 static + ${cleanArticles.length} articles)`);

    // Write sitemap-images.xml
    const imageSitemap = generateImageSitemap(cleanArticles);
    fs.writeFileSync(SITEMAP_IMG_FILE, imageSitemap);
    const imgCount = cleanArticles.filter(a => a.og_image || a.image).length;
    console.log(`SUCCESS: sitemap-images.xml — ${imgCount} image${imgCount !== 1 ? 's' : ''}`);

    // Write per-article static HTML (social share previews)
    if (fs.existsSync(TEMPLATE_FILE)) {
      const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
      let pageCount = 0;
      cleanArticles.forEach(article => {
        const dir = path.join(INSIGHTS_DIR, article.slug);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), generatePageHtml(template, article));
        pageCount++;
      });
      console.log(`SUCCESS: ${pageCount} per-article HTML page${pageCount !== 1 ? 's' : ''} written to /insights/<slug>/index.html`);
    } else {
      console.log('  WARNING: article.html template not found — skipped per-article HTML generation');
    }

    // Summary
    console.log('\n' + '─'.repeat(56));
    console.log(`ℹ  ${totalAutofills} field${totalAutofills !== 1 ? 's' : ''} auto-filled across all articles`);
    if (totalWarnings > 0) {
      console.log(`⚠  ${totalWarnings} SEO warning${totalWarnings !== 1 ? 's' : ''} across all articles — review above`);
    } else {
      console.log('✓  All articles passed SEO checks');
    }

    // Notify search engines (IndexNow only — Google/Bing pings deprecated)
    console.log('\nNotifying search engines...');
    await notifyIndexNow(cleanArticles);
    console.log('  GOOGLE: relies on auto-discovery via robots.txt sitemap + Search Console');
    console.log('  BING:   covered by IndexNow above (also pulls from Search Console)');

    console.log('\nBuild complete.\n');

  } catch(err) {
    console.error('\nFATAL BUILD ERROR:', err.message);
    fs.writeFileSync(OUTPUT_FILE, '[]');
    process.exit(1);
  }
}

main();
