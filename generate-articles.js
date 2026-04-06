// Netlify build script - generates articles.json from /insights/*.md files
const fs = require('fs');
const path = require('path');

const INSIGHTS_DIR = path.join(__dirname, 'insights');
const OUTPUT_FILE = path.join(__dirname, 'articles.json');

function parseFrontmatter(text, filename) {
  const result = { slug: filename.replace('.md', ''), title: '', date: '', category: '', excerpt: '', image: '' };

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) { console.log('  WARNING: No frontmatter in ' + filename); return result; }
  const fm = fmMatch[1];

  // Title - handles multiline quoted values
  let tm = fm.match(/^title:\s*"((?:[^"\n]|\n[ \t]+)+)"/m);
  if (tm) { result.title = tm[1].replace(/\n\s+/g, ' ').trim(); }
  else {
    tm = fm.match(/^title:\s*'((?:[^'\n]|\n[ \t]+)+)'/m);
    if (tm) { result.title = tm[1].replace(/\n\s+/g, ' ').trim(); }
    else { tm = fm.match(/^title:\s*(.+)$/m); if (tm) result.title = tm[1].trim(); }
  }

  // Date - extract YYYY-MM-DD only
  const dm = fm.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  if (dm) { result.date = dm[1]; }

  // Category
  const cm = fm.match(/^category:\s*(.+)$/m);
  if (cm) { result.category = cm[1].trim().replace(/^['"]|['"]$/g, ''); }

  // Description - handles quoted strings with apostrophes
  let dem = fm.match(/^description:\s*"((?:[^"\\]|\\.)*)"/m);
  if (dem) { result.excerpt = dem[1].trim(); }
  else {
    dem = fm.match(/^description:\s*'((?:[^'\\]|\\.)*)'/m);
    if (dem) { result.excerpt = dem[1].trim(); }
    else { dem = fm.match(/^description:\s*(.+)$/m); if (dem) result.excerpt = dem[1].trim(); }
  }

  // Image - from first markdown image in body
  const body = text.slice(fmMatch[0].length);
  const im = body.match(/!\[.*?\]\(([^\s)"]+)/);
  if (im) {
    result.image = im[1];
    console.log('  image: ' + im[1]);
  } else {
    console.log('  WARNING: No image found in ' + filename);
  }

  return result;
}

try {
  if (!fs.existsSync(INSIGHTS_DIR)) {
    console.log('ERROR: insights directory not found at ' + INSIGHTS_DIR);
    fs.writeFileSync(OUTPUT_FILE, '[]');
    process.exit(0);
  }

  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'index.md');

  console.log('Found ' + files.length + ' article files');

  const articles = [];
  files.forEach(filename => {
    try {
      console.log('Parsing: ' + filename);
      const text = fs.readFileSync(path.join(INSIGHTS_DIR, filename), 'utf8');
      const parsed = parseFrontmatter(text, filename);
      if (parsed.title && parsed.date) {
        articles.push(parsed);
        console.log('  OK: ' + parsed.title.substring(0, 50) + ' | ' + parsed.date);
      } else {
        console.log('  SKIP: missing title=' + parsed.title + ' date=' + parsed.date);
      }
    } catch(e) {
      console.log('  ERROR parsing ' + filename + ': ' + e.message);
    }
  });

  // Sort newest first
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2));
  console.log('SUCCESS: Generated articles.json with ' + articles.length + ' articles');

} catch (err) {
  console.error('FATAL ERROR:', err.message);
  fs.writeFileSync(OUTPUT_FILE, '[]');
  process.exit(1);
}
