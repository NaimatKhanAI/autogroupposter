import { describe, it, expect } from 'vitest';
import {
  facebookUrl,
  groupSchema,
  postSchema,
  webhookSchema,
  canTransition,
  statuses,
} from '../src/domain';
describe('Facebook URL boundaries', () => {
  it('normalizes group URLs and removes tracking', () =>
    expect(facebookUrl('https://m.facebook.com/groups/123/?ref=share#about', true)).toBe(
      'https://www.facebook.com/groups/123',
    ));
  it.each([
    'https://facebook.com.evil.test/groups/1',
    'http://facebook.com/groups/1',
    'https://user:pass@facebook.com/groups/1',
    'https://facebook.com:8443/groups/1',
    'javascript:alert(1)',
    'https://facebook.com/groups/1/posts/2',
  ])('rejects unsafe or non-group input %s', (url) =>
    expect(() => facebookUrl(url, true)).toThrow(),
  );
  it('preserves post identity query parameters', () =>
    expect(facebookUrl('https://www.facebook.com/story.php?story_fbid=1&id=2&ref=share')).toBe(
      'https://www.facebook.com/story.php?story_fbid=1&id=2',
    ));
  it('rejects malformed groups', () =>
    expect(groupSchema.safeParse({ name: 'A', url: 'not a url' }).success).toBe(false));
  it('requires an owned Page UUID for manual posts', () =>
    expect(
      postSchema.safeParse({ page_id: '123', post_url: 'https://facebook.com/posts/1' }).success,
    ).toBe(false));
});
describe('honest queue state transitions', () => {
  it.each(['pending', 'scheduled', 'ready_for_user', 'failed', 'skipped', 'cancelled'] as const)(
    'cannot confirm directly from %s',
    (s) => expect(canTransition(s, 'confirmed_shared')).toBe(false),
  );
  it('allows manual confirmation only while awaiting it', () =>
    expect(canTransition('awaiting_confirmation', 'confirmed_shared')).toBe(true));
  it('confirmed and cancelled tasks are terminal', () => {
    for (const next of statuses) {
      expect(canTransition('confirmed_shared', next)).toBe(false);
      expect(canTransition('cancelled', next)).toBe(false);
    }
  });
  it('allows eligible failure retry', () =>
    expect(canTransition('failed', 'ready_for_user')).toBe(true));
});
describe('webhook schema', () => {
  const valid = {
    event: 'page.post.published',
    event_id: 'event-1',
    page_id: '123',
    post_id: '123_456',
    post_url: 'https://www.facebook.com/posts/456',
    published_at: '2026-10-13T10:00:00Z',
  };
  it('accepts a publication event', () => expect(webhookSchema.parse(valid).caption).toBe(''));
  it.each([
    { event: 'unrecognized' },
    { event_id: '' },
    { published_at: 'tomorrow' },
    { caption: 'x'.repeat(10001) },
  ])('rejects invalid payload %j', (change) =>
    expect(webhookSchema.safeParse({ ...valid, ...change }).success).toBe(false),
  );
});
