import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  bridgeConfigSchema,
  createAgentBridge,
  createAgentIntake,
  publishedPostSchema,
} from '../scripts/lib/agentBridge';

const pageId = 'a'.repeat(64),
  groupId = 'b'.repeat(64);
const event = {
  event: 'page.post.published',
  event_id: 'published-1',
  post_url: 'https://m.facebook.com/posts/123?ref=share',
  caption: 'Golf Country update',
};
function fixture() {
  const posts: (Record<string, any> & { id: string })[] = [];
  const rows = vi.fn(async (table: string) =>
    table === 'connected_pages'
      ? [{ id: pageId }]
      : table === 'facebook_groups'
        ? [{ id: groupId, enabled: true, page_id: pageId }]
        : posts,
  );
  const operation = vi.fn(async (action: string, body?: Record<string, any>) => {
    if (action === 'post.import') {
      const post = { id: 'c'.repeat(64), ...body?.values };
      posts.push(post);
      return post;
    }
    return { queued: 1 };
  });
  return { rows, operation, posts };
}
describe('published post intake', () => {
  it('normalizes URLs and rejects producer-controlled Pages, targets or confirmation', () => {
    expect(publishedPostSchema.parse(event).post_url).toBe('https://www.facebook.com/posts/123');
    for (const extra of [
      { page_id: pageId },
      { group_ids: [groupId] },
      { status: 'confirmed_shared' },
    ])
      expect(publishedPostSchema.safeParse({ ...event, ...extra }).success).toBe(false);
    expect(
      publishedPostSchema.safeParse({
        ...event,
        post_url: 'https://facebook.com.evil.test/posts/1',
      }).success,
    ).toBe(false);
    expect(bridgeConfigSchema.safeParse({ pageId: 'facebook-numeric-id' }).success).toBe(false);
  });
  it('retries without duplicate post imports and never confirms publication', async () => {
    const backend = fixture();
    const ingest = createAgentIntake(backend, { pageId, groupIds: [groupId] });
    expect(await ingest(event)).toMatchObject({
      existing: false,
      publication: 'requires_user_action',
    });
    expect(await ingest(event)).toMatchObject({ existing: true, target_groups: 1 });
    expect(
      backend.operation.mock.calls.filter(([action]) => action === 'post.import'),
    ).toHaveLength(1);
    expect(
      backend.operation.mock.calls.every(([action]) =>
        ['post.import', 'queue.add'].includes(action),
      ),
    ).toBe(true);
  });
  it('does not import when configured targets are missing, inactive or associated with another Page', async () => {
    for (const group of [
      null,
      { id: groupId, enabled: false },
      { id: groupId, enabled: true, page_id: 'other' },
    ]) {
      const backend = fixture();
      backend.rows.mockImplementation(async (table) =>
        table === 'connected_pages'
          ? [{ id: pageId }]
          : table === 'facebook_groups' && group
            ? [group]
            : [],
      );
      await expect(
        createAgentIntake(backend, { pageId, groupIds: [groupId] })(event),
      ).rejects.toThrow('active groups');
      expect(backend.operation).not.toHaveBeenCalled();
    }
  });
  it('supports import-only mode and refuses an existing post associated with another Page', async () => {
    const backend = fixture();
    const ingest = createAgentIntake(backend, { pageId, groupIds: [] });
    await ingest(event);
    expect(backend.operation.mock.calls.map(([action]) => action)).toEqual(['post.import']);
    backend.posts[0]!.page_id = 'other';
    await expect(ingest(event)).rejects.toThrow('another Page');
  });
});

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
async function endpoint(ingest = vi.fn(async () => ({ publication: 'requires_user_action' }))) {
  const token = 'x'.repeat(64),
    server = createAgentBridge(token, ingest);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/posts`;
  const send = (body: unknown, authorization = `Bearer ${token}`) =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { send, ingest };
}
describe('local bridge HTTP boundary', () => {
  it('requires a strong token and rejects unauthorized or invalid input before invoking Firebase', async () => {
    expect(() => createAgentBridge('weak', async () => ({}))).toThrow();
    const { send, ingest } = await endpoint();
    expect((await send(event, 'Bearer wrong')).status).toBe(401);
    expect((await send({ ...event, status: 'confirmed_shared' })).status).toBe(400);
    expect((await send({ ...event, caption: 'a'.repeat(70000) })).status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });
  it('reports only queue preparation and hides backend exception details', async () => {
    const { send } = await endpoint();
    expect(await (await send(event)).json()).toEqual({ publication: 'requires_user_action' });
    const failed = await endpoint(
      vi.fn(async () => {
        throw new Error('sensitive session detail');
      }),
    );
    const response = await failed.send(event);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('sensitive');
  });
});
