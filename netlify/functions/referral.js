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

  // Split full name into first/last
  const nameParts = contact_name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build the contact payload
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
      { key: 'contact.best_time',         field_value: best_time         || '' },
      { key: 'contact.challenge',         field_value: challenge         || '' },
      { key: 'contact.contact_title',     field_value: contact_title     || '' },
      { key: 'contact.business_industry', field_value: business_industry || '' },
      { key: 'contact.service',           field_value: service           || '' },
      { key: 'contact.ref',               field_value: ref               || '' },
      { key: 'contact.referrer_email',    field_value: referrer_email    || '' },
      { key: 'contact.referrer_name',     field_value: referrer_name     || '' }
    ]
  };

  // Step 1: Hit the GHL Contacts API
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
      console.error('GHL contact creation failed:', contactData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Contact creation failed', detail: contactData })
      };
    }

    console.log('Contact created/updated:', contactData.contact?.id);
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  // Step 2: Fire the webhook for workflow routing
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
