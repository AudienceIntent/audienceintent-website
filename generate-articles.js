// Netlify build script - generates articles.json from /insights/*.md files
const fs = require('fs');
const path = require('path');

const INSIGHTS_DIR = path.join(__dirname, 'insights');
const OUTPUT_FILE = path.join(__dirname, 'articles.json');

function parseFrontmatter(text, filename) {
  const result = {
    slug: filename.replace('.md', ''),
    title: '',
    date: '',
    category: '',
    excerpt: '',
    image: ''
  };

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.log('  WARNING: No frontmatter in ' + filename);
    return result;
  }
  const fm = fmMatch[1];

  // Title - quoted or unquoted
  let tm = fm.match(/^title:\s*"((?:[^"\\]|\\.)*)"/m);
  if (tm) { result.title = tm[1].trim(); }
  else {
    tm = fm.match(/^title:\s*'((?:[^'\\]|\\.)*)'/m);
    if (tm) { result.title = tm[1].trim(); }
    else {
      // Multiline unquoted (Decap wraps long titles)
      tm = fm.match(/^title:\s*([\s\S]*?)(?=\n\w)/m);
      if (tm) { result.title = tm[1].replace(/\n\s+/g, ' ').trim(); }
    }
  }

  // Date - handle both "2025-12-20" and 2026-04-06T17:30:00.000-04:00
  const dm = fm.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  if (dm) { result.date = dm[1]; }

  // Category - quoted or unquoted
  const cm = fm.match(/^category:\s*"?([^"\n]+)"?\s*$/m);
  if (cm) { result.category = cm[1].trim().replace(/^"|"$/g, ''); }

  // Image - check frontmatter first (old Framer articles)
  const im = fm.match(/^image:\s*"?([^"\n]+)"?\s*$/m);
  if (im) {
    result.image = im[1].trim().replace(/^"|"$/g, '');
  } else {
    // Then check body (new Decap articles)
    const body = text.slice(fmMatch[0].length);
    const bm = body.match(/!\[.*?\]\(([^\s)"]+)/);
    if (bm) { result.image = bm[1]; }
  }

  // Description - quoted or unquoted
  let dem = fm.match(/^description:\s*"((?:[^"\\]|\\.)*)"/m);
  if (dem) { result.excerpt = dem[1].trim(); }
  else {
    dem = fm.match(/^description:\s*'((?:[^'\\]|\\.)*)'/m);
    if (dem) { result.excerpt = dem[1].trim(); }
    else {
      dem = fm.match(/^description:\s*(.+)$/m);
      if (dem) { result.excerpt = dem[1].trim().replace(/^"|"$/g, ''); }
    }
  }

  console.log('  title:    ' + result.title.substring(0, 50));
  console.log('  date:     ' + result.date);
  console.log('  category: ' + result.category);
  console.log('  image:    ' + (result.image || 'NONE'));
  console.log('  excerpt:  ' + result.excerpt.substring(0, 50));

  return result;
}

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

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2));
  console.log('\nSUCCESS: Generated articles.json with ' + articles.length + ' articles');

} catch(err) {
  console.error('FATAL:', err.message);
  fs.writeFileSync(OUTPUT_FILE, '[]');
  process.exit(1);
}
