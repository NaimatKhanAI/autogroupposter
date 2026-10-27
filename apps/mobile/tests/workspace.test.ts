import { describe, expect, it } from 'vitest';
import type { Group, Task } from '../src/domain';
import {
  filterGroups,
  filterQueue,
  queueSummary,
  reminderDate,
  selectableGroups,
  toggleVisibleSelection,
} from '../src/workspace';

describe('reminder validation', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  it('allows immediate sharing and normalizes future reminders to UTC', () => {
    expect(reminderDate('', now)).toBeNull();
    expect(reminderDate('2026-10-22T09:00:00-07:00', now)).toBe('2026-10-22T16:00:00.000Z');
  });
  it('rejects invalid, past and timezone-free reminders', () => {
    for (const value of [
      'invalid',
      '2026-10-20T12:00:00Z',
      '2026-10-21T12:00:00Z',
      '2026-10-23T12:00:00',
    ])
      expect(() => reminderDate(value, now)).toThrow();
  });
});

const group = (id: string, values: Partial<Group> = {}): Group => ({
  id,
  name: id,
  url: `https://www.facebook.com/groups/${id}`,
  enabled: true,
  notes: '',
  collection: '',
  page_id: null,
  last_shared_at: null,
  ...values,
});
const task = (id: string, values: Partial<Task> = {}): Task => ({
  id,
  post_id: 'post',
  group_id: id,
  status: 'ready_for_user',
  scheduled_at: null,
  paused: false,
  attempt_count: 0,
  last_error: null,
  confirmation_source: null,
  ...values,
});

describe('workspace group selection', () => {
  it('excludes inactive, other-Page and already assigned groups including terminal tasks', () => {
    const groups = [
      group('available'),
      group('owned', { page_id: 'page' }),
      group('other', { page_id: 'other' }),
      group('inactive', { enabled: false }),
      group('done'),
    ];
    expect(
      selectableGroups(groups, [task('done', { status: 'confirmed_shared' })], 'post', 'page').map(
        (g) => g.id,
      ),
    ).toEqual(['available', 'owned']);
    expect(
      selectableGroups([group('done')], [task('done', { post_id: 'other' })], 'post', 'page'),
    ).toHaveLength(1);
  });
  it('preserves hidden selections when selecting and deselecting visible groups', () => {
    expect(toggleVisibleSelection(['hidden', 'one'], ['one', 'two'])).toEqual([
      'hidden',
      'one',
      'two',
    ]);
    expect(toggleVisibleSelection(['hidden', 'one', 'two'], ['one', 'two'])).toEqual(['hidden']);
    expect(toggleVisibleSelection(['hidden'], [])).toEqual(['hidden']);
  });
  it('searches rules within a collection and puts never-shared groups first without mutating input', () => {
    const groups = [
      group('z', { collection: 'Local', notes: 'Golf', last_shared_at: '2026-10-01' }),
      group('a', { collection: 'Local', notes: 'Golf' }),
      group('b', { collection: 'Other', notes: 'Golf' }),
    ];
    expect(filterGroups(groups, ' GOLF ', 'Local', 'least_shared').map((g) => g.id)).toEqual([
      'a',
      'z',
    ]);
    expect(groups.map((g) => g.id)).toEqual(['z', 'a', 'b']);
  });
});

describe('queue priorities and counts', () => {
  const tasks = [
    task('paused', { paused: true }),
    task('ready'),
    task('confirm', { status: 'awaiting_confirmation' }),
    task('done', { status: 'confirmed_shared', paused: true }),
    task('later', { status: 'scheduled', scheduled_at: '2026-11-02' }),
    task('sooner', { status: 'scheduled', scheduled_at: '2026-11-01' }),
  ];
  it('prioritizes confirmations, ready tasks and upcoming schedules before paused tasks', () => {
    expect(filterQueue(tasks, 'active', '').map((t) => t.id)).toEqual([
      'confirm',
      'ready',
      'sooner',
      'later',
      'paused',
    ]);
    expect(filterQueue(tasks, 'paused', '').map((t) => t.id)).toEqual(['paused']);
    expect(queueSummary(tasks)).toEqual({ ready: 1, confirmation: 1, scheduled: 2, paused: 1 });
  });
  it('supports newest sorting and searches related records without matching missing values', () => {
    const dated = [
      { ...task('old'), created_at: '2026-10-01' },
      { ...task('new'), created_at: '2026-10-02', facebook_groups: group('Golf Country') },
    ];
    expect(filterQueue(dated, 'all', '', 'newest').map((t) => t.id)).toEqual(['new', 'old']);
    expect(filterQueue(dated, 'all', ' golf ').map((t) => t.id)).toEqual(['new']);
    expect(filterQueue(dated, 'all', 'undefined')).toEqual([]);
  });
});
