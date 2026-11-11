// Run after node generate-articles.js && node generate-videos.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('insights/index.html', 'utf8');
assert.equal((html.match(/class="card-featured video-card"/g) || []).length, 1);
assert.equal((html.match(/class="card-featured"/g) || []).length, 0);
assert.match(html, /href="https:\/\/www.audienceintent.ai\/videos\/what-is-aeo\/" data-format="videos"/);
assert.match(html, /1:38 &middot; Video/);
assert.equal((html.match(/<button[^>]*data-format=/g) || []).length, 3);
assert.ok(html.indexOf('class="card-featured video-card"') < html.indexOf('class="card"'));

function element(attrs = {}, textContent = '') {
  const handlers = {}, classes = new Set();
  return {
    textContent, style: {}, value: '',
    getAttribute: k => attrs[k],
    setAttribute: (k,v) => { attrs[k] = v; },
    classList: {toggle: (k,on) => on ? classes.add(k) : classes.delete(k), contains: k => classes.has(k)},
    addEventListener: (name,fn) => {handlers[name] = fn;},
    emit: name => handlers[name]({preventDefault(){}}),
    focus() {}
  };
}
const video = element({'data-format':'videos','data-cat':'AI Recommended'},'What Is AEO Video 01');
const article = element({'data-cat':'AI Recommended'},'What Is AEO Complete guide');
const news = element({'data-cat':'Company News'},'Agency news');
const formats = ['all','articles','videos'].map(v => element({'data-format':v}));
const topics = ['All','AI Recommended','Company News'].map(v => element({'data-cat':v}));
const search = element(), clear = element(), none = element();
const ids = {grid:{children:[video,article,news]},search,clearSearch:clear,'no-results':none};
const window = {location:{search:'?format=videos',href:'https://www.audienceintent.ai/insights?format=videos'},
  history:{replaceState(a,b,url){window.location.href=String(url);}}};
vm.runInNewContext(fs.readFileSync('insights/insights.js','utf8'),{
  URL, URLSearchParams, window,
  document:{
    getElementById:id=>ids[id],
    querySelectorAll:selector=> selector.includes('data-format') ? formats : topics
  }
});
const visible = e => !e.classList.contains('hidden');
assert.ok(visible(video) && !visible(article) && !visible(news), 'Videos deep link');
assert.equal(formats[2].getAttribute('aria-pressed'),'true');
topics[2].emit('click');
assert.equal(none.style.display,'block','Incompatible topic shows empty state');
clear.emit('click');
assert.ok(visible(video) && visible(article) && visible(news),'Reset all filters');
formats[1].emit('click');
assert.ok(!visible(video) && visible(article) && visible(news),'Articles only');
topics[1].emit('click');
assert.ok(visible(article) && !visible(news),'Format and topic intersect');
search.value='no matching answer'; search.emit('input');
assert.equal(none.style.display,'block');
clear.emit('click');
search.value='video 01'; search.emit('input');
assert.ok(visible(video) && !visible(article) && !visible(news),'Search finds video');
formats[2].emit('click');
assert.ok(window.location.href.includes('format=videos'));
console.log('Answers navigation: static discovery, format, topic, search, reset and deep links passed.');
