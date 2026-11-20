const fs = require('node:fs');
const assert = require('node:assert/strict');
for(const file of ['index.html','es/index.html']) {
 const html=fs.readFileSync(file,'utf8');
 const sec=html.match(/<section[^>]+id="why90"[\s\S]*?<\/section>/)[0];
 assert.equal((sec.match(/class="eng"/g)||[]).length,5);
 assert.equal((sec.match(/class="lane-l"/g)||[]).length,5);
 for(const [name,day] of [['Perplexity',14],['Gemini',50],['Google AI',55],['Claude',65],['ChatGPT',75]]) {
  assert(sec.includes(`</i>${name}</div>`),`${file}: ${name}`);
  assert(sec.includes(`style="width:${day}%"`));
  assert(sec.includes(`style="left:${day}%"`));
 }
 assert(!/ALL THREE|LAS TRES|all three|las tres/.test(sec));
 for(const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
}
console.log('Five-engine homepage chart EN/ES passed');
