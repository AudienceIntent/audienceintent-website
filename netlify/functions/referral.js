export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const {
    contact_name = '',
    contact_email,
    contact_phone,
    business_name,
    business_website,
    referrer_name,
    referrer_email,
    service,
    ref,
    best_time,
    challenge,
    contact_title,
    business_industry
  } = body;

  const nameParts = contact_name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const contactPayload = {
    locationId: process.env.GHL_LOCATION_ID,
    email: contact_email,
    phone: contact_phone,
    firstName,
    lastName,
    companyName: business_name,
    website: business_website,
    tags: ['referral'],
    customFields: [
      { key: 'best_time',         value: best_time         || '' },
      { key: 'challenge',         value: challenge         || '' },
      { key: 'contact_title',     value: contact_title     || '' },
      { key: 'business_industry', value: business_industry || '' },
      { key: 'service',           value: service           || '' },
      { key: 'ref',               value: ref               || '' },
      { key: 'referrer_email',    value: referrer_email    || '' },
      { key: 'referrer_name',     value: referrer_name     || '' }
    ]
  };

  let contactData;
  try {
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    contactData = await contactRes.json();

    if (!contactRes.ok) {
      console.error('GHL contact creation failed:', JSON.stringify(contactData));
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Contact creation failed', detail: contactData })
      };
    }

    console.log('Contact created/updated:', contactData.contact?.id);
    console.log('Full response:', JSON.stringify(contactData));
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  try {
    await fetch(process.env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        contactId: contactData.contact?.id
      })
    });
  } catch (err) {
    console.error('Webhook fire failed (non-fatal):', err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, contactId: contactData.contact?.id })
  };
}
