import { z } from 'zod';
export const statuses = [
  'pending',
  'scheduled',
  'ready_for_user',
  'awaiting_confirmation',
  'confirmed_shared',
  'failed',
  'skipped',
  'cancelled',
] as const;
export type TaskStatus = (typeof statuses)[number];
export function facebookUrl(value: string, group = false): string {
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    !['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('Use an https://www.facebook.com link.');
  if (group && !/^\/groups\/[a-zA-Z0-9._-]+\/?$/.test(url.pathname))
    throw new Error('Use a Facebook group link, such as /groups/your-group.');
  if (url.pathname === '/') throw new Error('Use a specific post or group link.');
  url.hostname = 'www.facebook.com';
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (!['story_fbid', 'id', 'fbid'].includes(key)) url.searchParams.delete(key);
  if (group) url.search = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString();
}
export const recordIdSchema = z
  .string()
  .regex(
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{64})$/i,
    'Invalid record ID.',
  );
export const groupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().transform((v, ctx) => {
    try {
      return facebookUrl(v, true);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  }),
  notes: z.string().max(2000).default(''),
  collection: z.string().max(80).default(''),
  page_id: recordIdSchema.nullable().default(null),
  enabled: z.boolean().default(true),
});
export const postSchema = z.object({
  page_id: recordIdSchema,
  caption: z.string().max(10000).default(''),
  post_url: z.string().transform((v, ctx) => {
    try {
      return facebookUrl(v);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  }),
  media_type: z.enum(['text', 'image', 'link', 'video']).default('link'),
});
export const webhookSchema = z.object({
  event: z.literal('page.post.published'),
  event_id: z.string().min(1).max(200),
  page_id: z.string().min(1).max(100),
  post_id: z.string().min(1).max(200),
  post_url: z.string().url(),
  caption: z.string().max(10000).default(''),
  image_url: z.string().url().nullable().optional(),
  media_type: z.enum(['text', 'image', 'link', 'video']).default('text'),
  published_at: z.string().datetime({ offset: true }),
});
const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['scheduled', 'ready_for_user', 'cancelled', 'skipped'],
  scheduled: ['pending', 'ready_for_user', 'cancelled', 'skipped'],
  ready_for_user: ['awaiting_confirmation', 'cancelled', 'skipped'],
  awaiting_confirmation: ['confirmed_shared', 'failed', 'ready_for_user', 'cancelled', 'skipped'],
  confirmed_shared: [],
  failed: ['ready_for_user', 'cancelled', 'skipped'],
  skipped: ['ready_for_user'],
  cancelled: [],
};
export function canTransition(from: TaskStatus, to: TaskStatus) {
  return transitions[from].includes(to);
}
export const label = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export interface Page {
  id: string;
  name: string;
  facebook_page_id: string;
  is_default: boolean;
  connection_status: string;
}
export interface Group {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  notes: string;
  collection: string;
  page_id: string | null;
  last_shared_at: string | null;
}
export interface Post {
  id: string;
  page_id: string;
  caption: string;
  post_url: string;
  facebook_post_id: string | null;
  image_url: string | null;
  published_at: string;
  media_type: string;
  connected_pages?: { name: string };
}
export interface Task {
  id: string;
  post_id: string;
  group_id: string;
  status: TaskStatus;
  scheduled_at: string | null;
  paused: boolean;
  attempt_count: number;
  last_error: string | null;
  confirmation_source: string | null;
  imported_posts?: Post;
  facebook_groups?: Group;
}
