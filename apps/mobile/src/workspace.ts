import type { Group, Task } from './domain';
export function reminderDate(when: string, now = Date.now()): string | null {
  if (!when) return null;
  const time = new Date(when);
  if (!Number.isFinite(time.getTime()) || time.getTime() <= now)
    throw new Error('Choose a future date and time.');
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(when))
    throw new Error('Include a timezone offset, such as -07:00.');
  return time.toISOString();
}
export function selectableGroups(groups: Group[], tasks: Task[], postId: string, pageId: string) {
  const assigned = new Set(tasks.filter((t) => t.post_id === postId).map((t) => t.group_id));
  return groups.filter(
    (g) => g.enabled && (!g.page_id || g.page_id === pageId) && !assigned.has(g.id),
  );
}
export function filterGroups(
  groups: Group[],
  search: string,
  collection = '',
  sort: 'name' | 'least_shared' = 'name',
) {
  const term = search.trim().toLocaleLowerCase();
  return groups
    .filter(
      (g) =>
        (!collection || g.collection === collection) &&
        `${g.name} ${g.collection} ${g.notes}`.toLocaleLowerCase().includes(term),
    )
    .sort((a, b) =>
      sort === 'least_shared'
        ? (a.last_shared_at ?? '').localeCompare(b.last_shared_at ?? '') ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}
export function toggleVisibleSelection(selected: string[], visible: string[]) {
  if (!visible.length) return selected;
  const ids = new Set(visible);
  return visible.every((id) => selected.includes(id))
    ? selected.filter((id) => !ids.has(id))
    : [...new Set([...selected, ...visible])];
}
export function queueSummary(tasks: Task[]) {
  return {
    ready: tasks.filter((t) => t.status === 'ready_for_user' && !t.paused).length,
    confirmation: tasks.filter((t) => t.status === 'awaiting_confirmation').length,
    scheduled: tasks.filter((t) => t.status === 'scheduled' && !t.paused).length,
    paused: tasks.filter(
      (t) => t.paused && ['pending', 'scheduled', 'ready_for_user'].includes(t.status),
    ).length,
  };
}
export function filterQueue(
  tasks: (Task & { created_at?: string })[],
  filter: string,
  search: string,
  sort: 'priority' | 'newest' = 'priority',
) {
  const priority: Record<string, number> = {
    awaiting_confirmation: 0,
    ready_for_user: 1,
    failed: 2,
    scheduled: 3,
    pending: 4,
    skipped: 6,
    cancelled: 7,
    confirmed_shared: 8,
  };
  const term = search.trim().toLocaleLowerCase();
  return tasks
    .filter(
      (t) =>
        (filter === 'all' ||
          (filter === 'active' &&
            !['confirmed_shared', 'cancelled', 'skipped'].includes(t.status)) ||
          (filter === 'paused' &&
            t.paused &&
            ['pending', 'scheduled', 'ready_for_user'].includes(t.status)) ||
          t.status === filter) &&
        `${t.facebook_groups?.name ?? ''} ${t.imported_posts?.caption ?? ''}`
          .toLocaleLowerCase()
          .includes(term),
    )
    .sort((a, b) => {
      if (sort === 'newest')
        return (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.id.localeCompare(b.id);
      const rank = (t: Task) =>
        t.paused && ['pending', 'scheduled', 'ready_for_user'].includes(t.status)
          ? 5
          : (priority[t.status] ?? 9);
      return (
        rank(a) - rank(b) ||
        (a.status === 'scheduled' && b.status === 'scheduled'
          ? (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
          : 0) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
        a.id.localeCompare(b.id)
      );
    });
}
