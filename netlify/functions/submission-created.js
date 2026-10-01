// ============================================================
// submission-created — runs automatically after every verified
// Netlify Forms submission on this site.
//
// Handles:
//   ai-recommended-onboarding (/onboarding)      → tag "air-onboarded"
//     (+ "air-addon-interest" if they ticked Claude/Grok)
//   dbr-onboarding (/onboarding-dbr)             → tag "dbr-onboarded"
//
// For each:
//   1. Upserts the client as a GHL contact (matched by email)
//   2. Adds the tag(s) — use "Contact Tag Added" as the GHL
//      workflow trigger
//   3. Saves every answer as a note on the contact
//   4. Optional: if GHL_ONBOARDING_WEBHOOK_URL is set, also POSTs
//      the flat answers to that inbound webhook
//
// The support@ email comes from Netlify's own form notification,
// so a GHL failure here never loses a submission.
// Env: GHL_API_KEY, GHL_LOCATION_ID (already set for /referral)
// ============================================================

const GHL = 'https://services.leadconnectorhq.com';
const AIR_LABELS = [
  ['company_name', 'Company'],
  ['website', 'Website'],
  ['contact_name', 'Contact name'],
  ['contact_email', 'Contact email'],
  ['contact_phone', 'Phone'],
  ['other_domains', '2. Other domains / brands'],
  ['alt_names', '3. Alternative names / spellings'],
  ['business_type', '4. Business type'],
  ['flagship_offers', '5. Main offers + differentiators'],
  ['buyer_types', '6. Buyer types'],
  ['competitors', '7. Competitors'],
  ['competitor_lists', '8. Lists / review sites ranking competitors above them'],
  ['markets', '9. Markets + locations'],
  ['engines', '10. Engines to track'],
  ['addon_interest', '10b. Add-on interest (Claude / Grok)'],
  ['priority_topics', '11. Priority categories / questions'],
  ['seasonal', '12. Seasonal peaks / launches'],
  ['why_now', '13. Why now'],
  ['known_gaps', '14. Known gaps + their theory'],
  ['primary_goal', '15. Primary goal'],
  ['current_kpis', '16. Current KPIs'],
  ['analytics_owner', '17. GSC / GA4 / Bing Webmaster owner'],
  ['cms', '18. CMS'],
  ['site_changes', '18b. Who can make site changes'],
  ['third_parties', '19. Other agencies / consultants'],
  ['brand_links', '20. Brand / tone docs'],
  ['compliance', '21. Compliance rules'],
  ['day_to_day_contact', '22. Day-to-day contact'],
  ['final_approver', '22b. Final approver'],
  ['anything_else', '23. Anything else'],
  ['submitted_at', 'Submitted at'],
];

const DBR_LABELS = [
  ['contact_name', '1. Day-to-day contact'],
  ['contact_email', 'Contact email'],
  ['contact_phone', 'Contact phone'],
  ['legal_name', '2. Legal business name'],
  ['dba_name', 'Name customers know them by'],
  ['business_address', '3. Business address'],
  ['website', '4. Website'],
  ['business_email', 'Business email'],
  ['business_phone', 'Business phone'],
  ['industry', 'Industry'],
  ['primary_offer', '5. Main service / product'],
  ['timezone', '6. Time zone'],
  ['business_hours', 'Business hours'],
  ['faq_link', '7. FAQ / knowledge base'],
  ['primary_objective', '8. Primary objective'],
  ['reactivation_offer', '9. Reactivation offer'],
  ['qualifying_questions', '10. Qualifying questions'],
  ['talking_points', '11. Questions / objections / talking points'],
  ['handoff_contact', '12. Receives appointments / transfers'],
  ['handoff_link', 'Calendar link / transfer number'],
  ['handoff_hours', 'Handoff availability'],
  ['avg_sale_value', '13. Average sale value'],
  ['close_rate', 'Close rate'],
  ['sales_reporting', 'How sales are confirmed'],
  ['lead_count', '14. Leads with valid SMS opt-in'],
  ['lead_type', '15. Lead type'],
  ['lead_age', '16. Lead age'],
  ['last_contacted', 'Last contacted / how'],
  ['recent_sms', '17. Recent SMS reactivation attempt'],
  ['lead_source', '18. Where leads are kept'],
  ['dnc_list', '19. Do-not-contact / opt-out list'],
  ['optin_url', '20. Opt-in page / form'],
  ['optin_language', '21. Opt-in language'],
  ['optin_confirmation', '22. Opt-in confirmation message'],
  ['anything_else', '23. Anything else'],
  ['compliance_confirm', 'SMS consent confirmation'],
  ['submitted_at', 'Submitted at'],
];

const FORMS = {
  'ai-recommended-onboarding': {
    labels: AIR_LABELS,
    title: 'AI RECOMMENDED ONBOARDING',
    source: 'AI Recommended Onboarding',
    company: (d) => d.company_name,
    tags: (d) => ['air-onboarded', ...(String(d.addon_interest || '').trim() ? ['air-addon-interest'] : [])],
  },
  'dbr-onboarding': {
    labels: DBR_LABELS,
    title: 'DATABASE REACTIVATION ONBOARDING',
    source: 'Database Reactivation Onboarding',
    company: (d) => d.dba_name || d.legal_name,
    tags: () => ['dbr-onboarded'],
  },
};

async function ghl(path, body) {
  const res = await fetch(GHL + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GHL ${path} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function handler(event) {
  let payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const cfg = payload && FORMS[payload.form_name];
  if (!cfg) {
    return { statusCode: 200, body: 'Ignored (not an onboarding form)' };
  }
  const LABELS = cfg.labels;

  const d = payload.data || {};
  const fullName = String(d.contact_name || '').trim();
  const [firstName = '', ...rest] = fullName.split(/\s+/);
  const companyName = cfg.company(d);

  let contactId = null;
  try {
    // 1. Upsert contact (matches existing paid client by email)
    const up = await ghl('/contacts/upsert', {
      locationId: process.env.GHL_LOCATION_ID,
      email: d.contact_email,
      phone: d.contact_phone || undefined,
      firstName,
      lastName: rest.join(' '),
      companyName,
      website: d.website,
      source: cfg.source,
    });
    contactId = up.contact?.id;
    console.log('GHL contact upserted:', contactId, up.new ? '(new)' : '(existing)');

    if (contactId) {
      // 2. Tags (added, never replaces existing tags)
      const tags = cfg.tags(d);
      await ghl(`/contacts/${contactId}/tags`, { tags });

      // 3. Full answers as a contact note
      const lines = LABELS
        .filter(([k]) => String(d[k] ?? '').trim() !== '')
        .map(([k, label]) => `${label}:\n${String(d[k]).trim()}`);
      await ghl(`/contacts/${contactId}/notes`, {
        body: `${cfg.title}\n\n${lines.join('\n\n')}`,
      });
    }
  } catch (err) {
    console.error('GHL sync failed:', err.message);
  }

  // 4. Optional inbound webhook with flat fields
  if (process.env.GHL_ONBOARDING_WEBHOOK_URL) {
    try {
      const flat = {};
      LABELS.forEach(([k]) => { flat[k] = d[k] ?? ''; });
      await fetch(process.env.GHL_ONBOARDING_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...flat,
          email: d.contact_email,
          first_name: firstName,
          last_name: rest.join(' '),
          company_name: companyName,
          contactId,
          source: payload.form_name,
        }),
      });
    } catch (err) {
      console.error('Onboarding webhook failed (non-fatal):', err.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, contactId }) };
}
