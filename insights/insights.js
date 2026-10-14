/* /insights page scripts — moved out of insights/index.html to keep the
   HTML lean (content-to-code ratio). Loaded with defer. If you change this
   file, bump the ?v= in insights/index.html: *.js is cached for a year. */

/* ARTICLES JS — loads articles-data.js then falls back to articles.json */
var ARTICLES = [];
var PER = 12, pg = 1, cat = 'All', q = '';
var SITE_ORIGIN = 'https://www.audienceintent.ai';

function loadArticles() {
  // Try articles-data.js first (static, faster), fallback to articles.json
  if (typeof window.ARTICLES_DATA !== 'undefined') {
    ARTICLES = window.ARTICLES_DATA;
    render();
    return;
  }
  fetch('/articles.json')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      ARTICLES = data;
      render();
    })
    .catch(function(err) {
      console.warn('articles.json unavailable:', err.message);
      document.getElementById('grid').innerHTML = '<div class="loading-state" style="grid-column:1/-1">Unable to load articles. <a href="https://www.audienceintent.ai" style="color:#00ff73">Return home</a></div>';
    });
}

function fd() {
  return ARTICLES.filter(function(a) {
    // Map display labels back to data categories
    var catMatch = cat === 'All' ||
      a.category === cat ||
      (cat === 'AI Visibility' && a.category === 'AI Visibility') ||
      (cat === 'Lead Reactivation' && a.category === 'Lead Reactivation');
    var qMatch = !q ||
      (a.title || '').toLowerCase().indexOf(q) > -1 ||
      (a.excerpt || '').toLowerCase().indexOf(q) > -1 ||
      (a.category || '').toLowerCase().indexOf(q) > -1;
    return catMatch && qMatch;
  });
}

function fmtDate(d) {
  if (!d) return '';
  var p = d.split('-');
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  try { return m[parseInt(p[1]) - 1] + ' ' + parseInt(p[2]) + ', ' + p[0]; }
  catch(e) { return d; }
}

function catColor(category) {
  if (!category) return '';
  var c = category.toLowerCase();
  if (c.indexOf('ai') > -1) return ' card-cat-b';
  if (c.indexOf('company') > -1 || c.indexOf('news') > -1) return ' card-cat-w';
  return '';
}

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Self-heal: if an image fails on first paint (the lazy/timing glitch that
// left new cards blank until a manual reflow), re-request it once. The file
// is reachable — it just didn't fire its load on first render.
function aiRetryImg(img) {
  if (img.dataset.retried) return;        // only ever retry once
  img.dataset.retried = '1';
  var src = img.getAttribute('src');
  img.removeAttribute('src');
  // Drop lazy so the re-request fires immediately, then re-point.
  img.setAttribute('loading', 'eager');
  requestAnimationFrame(function () { img.setAttribute('src', src); });
}

// After the grid HTML is injected, force every card image to commit a load.
// Reassigning src to its own value re-triggers the request for any image the
// browser deferred at the fold boundary — no blank cards regardless of where
// a new article lands in the list.
function nudgeImages() {
  var imgs = document.querySelectorAll('#grid img');
  for (var i = 0; i < imgs.length; i++) {
    var im = imgs[i];
    if (im.complete && im.naturalWidth > 0) continue; // already painted
    im.setAttribute('loading', 'eager');
    var s = im.getAttribute('src');
    if (s) { im.setAttribute('src', s); }
  }
}

function makeCard(a, isFeatured, eager) {
  var imgSrc = a.og_image || a.image || '';
  var readTime = a.read_time ? a.read_time + ' min read' : '';
  var titleEsc = escAttr(a.title);
  var articleUrl = SITE_ORIGIN + '/insights/' + a.slug;

  // Above-the-fold images load eagerly with high priority so they paint on
  // first load. Lazy-loading an in-viewport image is what was leaving the
  // top grid card blank until a manual reflow.
  var loadAttrs = eager
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';

  if (isFeatured && imgSrc) {
    return '<a class="card-featured" href="' + articleUrl + '" aria-label="' + titleEsc + '">'
      + '<img class="card-feat-img" src="' + escAttr(imgSrc) + '" alt="' + titleEsc + '" title="' + titleEsc + '" ' + loadAttrs + ' onerror="aiRetryImg(this)">'
      + '<div class="card-feat-body">'
      + '<div class="card-feat-cat">' + (a.category || '') + '</div>'
      + '<h2 class="card-feat-title">' + (a.title || '') + '</h2>'
      + '<div class="card-feat-excerpt">' + (a.excerpt || '') + '</div>'
      + '<div class="card-feat-foot">'
      + '<span class="card-feat-meta">' + fmtDate(a.date) + (readTime ? ' &middot; ' + readTime : '') + ' &middot; ' + (a.author || 'Kevin Bovett') + '</span>'
      + '<span class="card-feat-cta">Read article &rarr;</span>'
      + '</div></div></a>';
  }

  var imgHtml = imgSrc
    ? '<div class="card-img-wrap"><img class="card-img" src="' + escAttr(imgSrc) + '" alt="' + titleEsc + '" title="' + titleEsc + '" ' + loadAttrs + ' onerror="aiRetryImg(this)">' + (readTime ? '<span class="card-read-time">' + readTime + '</span>' : '') + '</div>'
    : '<div class="card-img-wrap" style="height:120px"><div class="card-no-img" aria-hidden="true">' + (a.category || 'AI').substring(0,2).toUpperCase() + '</div></div>';

  return '<a class="card" href="' + articleUrl + '" aria-label="' + titleEsc + '">'
    + imgHtml
    + '<div class="card-body">'
    + '<div class="card-cat' + catColor(a.category) + '">' + (a.category || '') + '</div>'
    + '<h2 class="card-title">' + (a.title || '') + '</h2>'
    + '<div class="card-excerpt">' + (a.excerpt || '').substring(0, 140) + (a.excerpt && a.excerpt.length > 140 ? '&hellip;' : '') + '</div>'
    + '<div class="card-foot">'
    + '<span class="card-meta">' + fmtDate(a.date) + (a.author ? ' &middot; ' + a.author : '') + '</span>'
    + '<span class="card-arrow" aria-hidden="true">&rarr;</span>'
    + '</div></div></a>';
}

function render() {
  var list = fd();
  var total = list.length;
  var pages = Math.ceil(total / PER);
  if (pg > pages) pg = 1;

  var countEl = document.getElementById('count');
  if (countEl) countEl.textContent = total + ' article' + (total !== 1 ? 's' : '');

  var grid = document.getElementById('grid');
  var noResults = document.getElementById('no-results');

  if (!list.length) {
    grid.innerHTML = '';
    if (noResults) noResults.style.display = 'block';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  if (noResults) noResults.style.display = 'none';

  var start = (pg - 1) * PER;
  var page = list.slice(start, start + PER);

  // First card on page 1 is featured (larger layout).
  // Eager-load the images that are above the fold on first paint:
  // the featured card + the first row of grid cards. The rest stay lazy.
  var html = '';
  page.forEach(function(a, idx) {
    var isFeatured = idx === 0 && pg === 1 && !q && cat === 'All';
    var eager = pg === 1 && idx < 4; // featured + first 3 grid cards
    html += makeCard(a, isFeatured, eager);
  });
  grid.innerHTML = html;
  requestAnimationFrame(nudgeImages); // force-paint any deferred card images

  // Pagination
  var pag = document.getElementById('pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  var b = '<button class="pg-btn pg-prev" onclick="gp(' + (pg - 1) + ')" aria-label="Previous page"' + (pg === 1 ? ' disabled style="opacity:.3"' : '') + '>&larr; Prev</button>';
  for (var i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= pg - 2 && i <= pg + 2))
      b += '<button class="pg-btn' + (i === pg ? ' active' : '') + '" onclick="gp(' + i + ')" aria-label="Page ' + i + '">' + i + '</button>';
    else if (i === pg - 3 || i === pg + 3)
      b += '<span style="color:rgba(248,247,246,.3);padding:0 4px">&hellip;</span>';
  }
  b += '<button class="pg-btn pg-next" onclick="gp(' + (pg + 1) + ')" aria-label="Next page"' + (pg === pages ? ' disabled style="opacity:.3"' : '') + '>Next &rarr;</button>';
  pag.innerHTML = b;
}

function gp(n) {
  var t = Math.ceil(fd().length / PER);
  if (n < 1 || n > t) return;
  pg = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function clearSearch() {
  document.getElementById('search').value = '';
  q = ''; pg = 1; render();
  return false;
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(function(b) {
      b.classList.remove('active', 'active-blue', 'active-white');
    });
    // Pick active variant by category for color coding
    var label = btn.getAttribute('data-cat');
    if (label === 'AI Recommended') btn.classList.add('active-blue');
    else if (label === 'Company News') btn.classList.add('active-white');
    else btn.classList.add('active');
    cat = label;
    pg = 1;
    render();
  });
});

// Search
document.getElementById('search').addEventListener('input', function() {
  q = this.value.toLowerCase().trim();
  pg = 1;
  render();
});

// Keyboard: Escape clears search
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && q) {
    clearSearch();
    document.getElementById('search').blur();
  }
});

document.addEventListener('DOMContentLoaded', loadArticles);

/* GHL Chat Widget — 7s delay, non-blocking */
(function(){
  function loadGHL(){
    var s=document.createElement('script');
    s.src='https://cdn.leadconnectorhq.com/leadconnector/chat-widget/chat-widget.js';
    s.setAttribute('data-use-email-validation','true');
    s.setAttribute('chat-widget-popup','true');
    s.setAttribute('data-widget-id','6849f6320a987f033d7a4a13');
    s.defer=true;
    document.body.appendChild(s);
  }
  if(document.readyState==='complete'){setTimeout(loadGHL,7000);}
  else{window.addEventListener('load',function(){setTimeout(loadGHL,7000);});}
})();

/* Mobile menu + keyboard nav */
(function(){
  var b=document.getElementById('burger');
  var m=document.getElementById('mobileMenu');
  if(!b||!m)return;
  window.closeMobile=function(){
    b.classList.remove('open');
    m.classList.remove('open');
    document.body.style.overflow='';
    b.setAttribute('aria-expanded','false');
  };
  b.addEventListener('click',function(e){
    e.stopPropagation();
    if(m.classList.contains('open')){
      window.closeMobile();
    } else {
      b.classList.add('open');
      m.classList.add('open');
      document.body.style.overflow='hidden';
      b.setAttribute('aria-expanded','true');
    }
  });
  m.addEventListener('click',function(e){if(e.target===m)window.closeMobile();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape' && m.classList.contains('open'))window.closeMobile();
  });
})();
