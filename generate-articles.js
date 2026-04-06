// Netlify build script - generates articles.json from /insights/*.md files
// This runs automatically on every Netlify deploy

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

  // Extract frontmatter between --- markers
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  const fm = match[1];

  // Parse title (handles multiline YAML values)
  const titleMatch = fm.match(/title:\s*["']?([\s\S]*?)["']?\s*\n(?=\w)/);
  if (titleMatch) {
    result.title = titleMatch[1]
      .replace(/\n\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  // Parse date
  const dateMatch = fm.match(/date:\s*([^\n]+)/);
  if (dateMatch) {
    result.date = dateMatch[1].trim().substring(0, 10);
  }

  // Parse category
  const catMatch = fm.match(/category:\s*([^\n]+)/);
  if (catMatch) {
    result.category = catMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // Parse description/excerpt
  const descMatch = fm.match(/description:\s*["']?([^"'\n]+)["']?/);
  if (descMatch) {
    result.excerpt = descMatch[1].trim();
  }

  // Extract first image from body
  const body = text.slice(match[0].length);
  const imgMatch = body.match(/!\[.*?\]\(([^)\s]+)/);
  if (imgMatch) {
    result.image = imgMatch[1];
  }

  return result;
}

try {
  // Read all .md files from insights folder
  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'index.md');

  console.log(`Found ${files.length} article files`);

  const articles = files
    .map(filename => {
      const filepath = path.join(INSIGHTS_DIR, filename);
      const text = fs.readFileSync(filepath, 'utf8');
      return parseFrontmatter(text, filename);
    })
    .filter(a => a.title && a.date) // Only include valid articles
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2));
  console.log(`Successfully generated articles.json with ${articles.length} articles`);

} catch (err) {
  console.error('Error generating articles.json:', err.message);
  process.exit(1);
}
