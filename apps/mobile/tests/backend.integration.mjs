import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
const base = process.env.TEST_FIREBASE_FUNCTIONS_URL;
if (!base)
  throw new Error(
    'Set TEST_FIREBASE_FUNCTIONS_URL for a disposable staging project. Tests are not silently skipped.',
  );
test('manage rejects missing and invalid auth', async () => {
  for (const token of ['', 'invalid']) {
    const r = await fetch(`${base}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { action: 'integration.status' } }),
    });
    assert.equal(r.status, 401);
  }
});
test('webhook rejects unsigned requests', async () => {
  const r = await fetch(`${base}/n8nWebhook`, { method: 'POST', body: '{}' });
  assert.equal(r.status, 401);
});
test('signed webhook imports once and rejects replay/collision', async () => {
  const id = process.env.TEST_INTEGRATION_ID,
    secret = process.env.TEST_WEBHOOK_SECRET,
    page = process.env.TEST_PAGE_ID;
  assert.ok(
    id && secret && page,
    'Set TEST_INTEGRATION_ID, TEST_WEBHOOK_SECRET and TEST_PAGE_ID for a disposable configured Page.',
  );
  const event = randomUUID();
  const payload = {
    event: 'page.post.published',
    event_id: event,
    page_id: page,
    post_id: `test_${event}`,
    post_url: `https://www.facebook.com/posts/test_${event}`,
    caption: 'Disposable backend integration fixture',
    published_at: new Date().toISOString(),
  };
  const send = (body, timestamp = String(Math.floor(Date.now() / 1000))) =>
    fetch(`${base}/n8nWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-integration-id': id,
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': createHmac('sha256', secret)
          .update(`${timestamp}.${body}`)
          .digest('hex'),
      },
      body,
    });
  const first = await send(JSON.stringify(payload));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).duplicate, false);
  const retry = await send(JSON.stringify(payload));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  const replay = await send(JSON.stringify(payload), String(Math.floor(Date.now() / 1000) - 600));
  assert.equal(replay.status, 401);
  const collision = await send(JSON.stringify({ ...payload, caption: 'Changed' }));
  assert.equal(collision.status, 400);
});
