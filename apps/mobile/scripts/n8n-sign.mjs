import { createHmac, randomUUID } from 'node:crypto';
const endpoint = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;
const integration = process.env.INTEGRATION_ID;
if (!endpoint || !secret || !integration || !process.env.FACEBOOK_PAGE_ID)
  throw new Error('Set WEBHOOK_URL, WEBHOOK_SECRET, INTEGRATION_ID, FACEBOOK_PAGE_ID.');
const payload = {
  event: 'page.post.published',
  event_id: process.env.EVENT_ID || randomUUID(),
  page_id: process.env.FACEBOOK_PAGE_ID,
  post_id: process.env.POST_ID || 'replace-with-real-post-id',
  post_url: process.env.POST_URL || 'https://www.facebook.com/posts/replace-with-real-post-id',
  caption: 'Integration test; replace with the published caption.',
  published_at: new Date().toISOString(),
};
const body = JSON.stringify(payload),
  timestamp = String(Math.floor(Date.now() / 1000));
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-integration-id': integration,
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex'),
  },
  body,
});
console.log('Webhook HTTP status:', response.status);
console.log(await response.text());
