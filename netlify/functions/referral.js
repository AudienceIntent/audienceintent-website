// netlify/functions/referral.js
// Server-side proxy that forwards referral form submissions to the GoHighLevel
// inbound webhook. Runs on Netlify (no browser CORS), sends proper JSON so GHL
// parses every field. The page POSTs here at /.netlify/functions/referral.

// You can override the webhook with a GHL_WEBHOOK_URL environment variable in
// Netlify (Site settings → Environment variables). Falls back to the hardcoded
// URL below if the env var isn't set.
const GHL_WEBHOOK_URL =
  process.env.GHL_WEBHOOK_URL ||
  "https://services.leadconnectorhq.com/hooks/aBFslbFOOHFBP075Donz/webhook-trigger/f31e724f-e851-4f08-b04d-404677a0bd5a";

export async function handler(event) {
  // Only accept POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  // Minimal server-side validation
  if (!payload.contact_email || !payload.referrer_email) {
    return { statusCode: 422, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  try {
    const res = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Upstream error", status: res.status, detail: text.slice(0, 300) }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Forward failed", detail: String(err) }) };
  }
}
