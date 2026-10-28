// ============================================================
// deploy-succeeded — Netlify runs this automatically after every
// successful deploy. On PRODUCTION deploys it tells IndexNow
// (Bing, Copilot, ChatGPT search via Bing, Yandex, Seznam, Naver)
// which pages changed, so they recrawl them right away.
//
// Changed = sitemap.xml <lastmod> within the last 2 days.
// Key file: /40218d87d9860e29757cf348154b22ab.txt (must stay in the repo root).
// ============================================================

const HOST = 'www.audienceintent.ai';
const KEY  = '40218d87d9860e29757cf348154b22ab';

exports.handler = async (event) => {
  let payload = {};
  try { payload = JSON.parse(event.body || '{}').payload || {}; } catch (e) {}
  if (payload.context && payload.context !== 'production') {
    return { statusCode: 200, body: 'skip: ' + payload.context };
  }
  try {
    const xml = await (await fetch('https://' + HOST + '/sitemap.xml')).text();
    const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const urls = [];
    for (const m of xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>/g)) {
      if (m[2].slice(0, 10) >= cutoff) urls.push(m[1].trim());
    }
    if (!urls.length) return { statusCode: 200, body: 'no changed urls' };
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls.slice(0, 10000) }),
    });
    console.log('IndexNow', res.status, urls.length, 'urls');
    return { statusCode: 200, body: 'indexnow ' + res.status + ' ' + urls.length };
  } catch (e) {
    console.log('IndexNow error', e.message);
    return { statusCode: 200, body: 'error ' + e.message };
  }
};
