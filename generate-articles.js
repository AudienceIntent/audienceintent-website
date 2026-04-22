// Netlify build script - generates articles.json and sitemap.xml from /insights/*.md files
const fs = require('fs');
const path = require('path');

const INSIGHTS_DIR = path.join(__dirname, 'insights');
const OUTPUT_FILE = path.join(__dirname, 'articles.json');
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');
const SITE_URL = 'https://audienceintent.ai';

// Minimal markdown-to-HTML converter for body content
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Remove leading image line (already captured as featured image)
  html = html.replace(/^!\[.*?\]\([^\)]+\)\s*\n?/m, '');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Images and links
  html = html.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:16px 0;">');
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Unordered lists - collect consecutive list items
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
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr>');

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
  const blockTags = /^(<h[1-6]|<ul|<ol|<li|<blockquote|<hr|<img|<\/)/;
  html = html.split('\n\n').map(function(chunk) {
    chunk = chunk.trim();
    if (!chunk) return '';
    if (blockTags.test(chunk)) return chunk;
    chunk = chunk.replace(/\n/g, ' ');
    return '<p>' + chunk + '</p>';
  }).filter(Boolean).join('\n');

  return html;
}

function parseFrontmatter(text, filename) {
  const result = {
    slug: filename.replace('.md', ''),
    title: '',
    date: '',
    category: '',
    excerpt: '',
    image: '',
    meta_title: '',
    description: '',
    focus_keyword: '',
    canonical: '',
    og_image: '',
    author: '',
    schema: '',
    content: ''
  };

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.log('  WARNING: No frontmatter in ' + filename);
    result.content = markdownToHtml(text);
    return result;
  }

  const fm = fmMatch[1];
  const body = text.slice(fmMatch[0].length).trim();

  // Title
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

  // Date
  const dm = fm.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (dm) { result.date = dm[1]; }

  // Category
  const cm = fm.match(/^category:\s*"?([^"\n]+)"?\s*$/m);
  if (cm) { result.category = cm[1].trim().replace(/^"|"$/g, ''); }

  // Image
  const im = fm.match(/^image:\s*"?([^"\n]+)"?\s*$/m);
  if (im) {
    result.image = im[1].trim().replace(/^"|"$/g, '');
  } else {
    const bm = body.match(/!\[.*?\]\(([^\s)"]+)/);
    if (bm) { result.image = bm[1]; }
  }

  // Description/excerpt
  let dem = fm.match(/^description:\s*"((?:[^"\\]|\\.)*)"/m);
  if (dem) { result.excerpt = dem[1].trim(); }
  else {
    dem = fm.match(/^description:\s*'((?:[^'\\]|\\.)*)'/m);
    if (dem) { result.excerpt = dem[1].trim(); }
    else {
      dem = fm.match(/^description:\s*(.+(?:\n[ \t]+.+)*)/m);
      if (dem) {
        result.excerpt = dem[1]
          .replace(/\n[ \t]+/g, ' ')
          .trim()
          .replace(/^"|"$/g, '');
      }
    }
  }

  // Meta title
  const mtm = fm.match(/^meta_title:\s*"?([^"\n]+)"?\s*$/m);
  if (mtm) { result.meta_title = mtm[1].trim().replace(/^"|"$/g, ''); }

  // Focus keyword
  const fkm = fm.match(/^focus_keyword:\s*"?([^"\n]+)"?\s*$/m);
  if (fkm) { result.focus_keyword = fkm[1].trim().replace(/^"|"$/g, ''); }

  // Canonical
  const canm = fm.match(/^canonical:\s*"?([^"\n]+)"?\s*$/m);
  if (canm) { result.canonical = canm[1].trim().replace(/^"|"$/g, ''); }

  // OG Image
  const ogm = fm.match(/^og_image:\s*"?([^"\n]+)"?\s*$/m);
  if (ogm) { result.og_image = ogm[1].trim().replace(/^"|"$/g, ''); }

  // Author
  const autm = fm.match(/^author:\s*"?([^"\n]+)"?\s*$/m);
  if (autm) { result.author = autm[1].trim().replace(/^"|"$/g, ''); }

  // Schema - multiline text field
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

  result.content = markdownToHtml(body);

  console.log('  title:    ' + result.title.substring(0, 50));
  console.log('  date:     ' + result.date);
  console.log('  category: ' + result.category);
  console.log('  image:    ' + (result.image || 'NONE'));
  console.log('  excerpt:  ' + result.excerpt.substring(0, 50));
  console.log('  content:  ' + result.content.substring(0, 60) + '...');

  return result;
}

function generateSitemap(articles) {
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/insights', priority: '0.9', changefreq: 'daily' },
  ];

  const staticUrls = staticPages.map(page => `
  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

  const articleUrls = articles.map(article => `
  <url>
    <loc>${SITE_URL}/insights/${article.slug}</loc>
    <lastmod>${article.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
</urlset>`;
}

async function pingSearchEngines() {
  const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
  const engines = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`
  ];
  for (const url of engines) {
    try {
      const res = await fetch(url);
      console.log(`Pinged: ${url} → ${res.status}`);
    } catch(e) {
      console.log(`Ping failed: ${url} → ${e.message}`);
    }
  }
}

async function main() {
  try {
    if (!fs.existsSync(INSIGHTS_DIR)) {
      console.log('ERROR: insights directory not found');
      fs.writeFileSync(OUTPUT_FILE, '[]');
      process.exit(0);
    }

    const files = fs.readdirSync(INSIGHTS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'index.md');

    console.log('Found ' + files.length + ' article files');

    const articles = [];
    files.forEach(filename => {
      try {
        console.log('\nParsing: ' + filename);
        const text = fs.readFileSync(path.join(INSIGHTS_DIR, filename), 'utf8');
        const parsed = parseFrontmatter(text, filename);
        if (parsed.title && parsed.date) {
          articles.push(parsed);
        } else {
          console.log('  SKIP: missing title or date');
        }
      } catch(e) {
        console.log('  ERROR: ' + e.message);
      }
    });

    // Sort newest first
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Write articles.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2));
    console.log('\nSUCCESS: Generated articles.json with ' + articles.length + ' articles');

    // Write sitemap.xml
    const sitemap = generateSitemap(articles);
    fs.writeFileSync(SITEMAP_FILE, sitemap);
    console.log('SUCCESS: Generated sitemap.xml with ' + (articles.length + 2) + ' URLs');

    // Ping search engines
    console.log('\nPinging search engines...');
    await pingSearchEngines();

  } catch(err) {
    console.error('FATAL:', err.message);
    fs.writeFileSync(OUTPUT_FILE, '[]');
    process.exit(1);
  }
}

main();
