import { errorMessage } from '../../src/errors';
import React, { useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { useRows, useOperation } from '../../src/api';
import { Task, statuses, label } from '../../src/domain';
import { filterQueue, queueSummary } from '../../src/workspace';
import { SummaryStrip, SectionHeading } from '../../src/workspaceUi';
import { Screen, Card, Txt, Button, Field, Row, Badge, State, FilterBar } from '../../src/ui';
export default function Queue() {
  const q = useRows<Task>('sharing_tasks', '*, imported_posts(*), facebook_groups(*)');
  const op = useOperation();
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'priority' | 'newest'>('priority');
  const rows = q.data && filterQueue(q.data, filter, search, sort);
  const summary = queueSummary(q.data ?? []);
  async function transition(t: Task, status: string, note?: string) {
    try {
      await op.mutateAsync({ action: 'task.transition', id: t.id, status, note });
      return true;
    } catch (e) {
      Alert.alert('Task update', errorMessage(e));
      return false;
    }
  }
  async function open(t: Task, share = false) {
    if (!(await transition(t, 'awaiting_confirmation'))) return;
    try {
      if (share) await Share.share({ message: t.imported_posts?.post_url ?? '' });
      else await Linking.openURL(t.facebook_groups!.url);
    } catch {
      Alert.alert(
        'Could not open Facebook',
        'The task awaits confirmation. Reopen Facebook or report a problem.',
      );
    }
  }
  function confirm(t: Task) {
    Alert.alert(
      'Confirm your sharing action',
      'Only confirm after you have completed sharing in the intended Facebook Group. This records your attestation; it does not verify publication with Meta.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'I shared this post',
          onPress: () =>
            transition(
              t,
              'confirmed_shared',
              'I completed sharing this post in the intended group.',
            ),
        },
      ],
    );
  }
  async function pause(paused: boolean) {
    try {
      await op.mutateAsync({ action: 'queue.pause', paused });
    } catch (e) {
      Alert.alert('Queue', errorMessage(e));
    }
  }
  return (
    <Screen
      title="Sharing queue"
      subtitle="One task. One group. A clear next step."
      onRefresh={() => q.refetch()}
      refresh={q.isRefetching}
    >
      {!q.isLoading && !q.error && (
        <SummaryStrip
          items={[
            { label: 'Ready to share', value: summary.ready, icon: 'play-circle-outline' },
            { label: 'To confirm', value: summary.confirmation, icon: 'checkmark-done-outline' },
            { label: 'Scheduled', value: summary.scheduled, icon: 'calendar-outline' },
            { label: 'Paused', value: summary.paused, icon: 'pause-circle-outline' },
          ]}
        />
      )}
      <Row>
        <Button title="Pause queue" secondary disabled={op.isPending} onPress={() => pause(true)} />
        <Button title="Resume" secondary disabled={op.isPending} onPress={() => pause(false)} />
      </Row>
      <Field label="Search tasks" value={search} onChangeText={setSearch} />
      <FilterBar
        values={['active', 'paused', 'all', ...statuses].map((s) => ({ key: s, title: label(s) }))}
        value={filter}
        onChange={setFilter}
      />
      <FilterBar
        values={[
          { key: 'priority', title: 'Needs attention first' },
          { key: 'newest', title: 'Newest first' },
        ]}
        value={sort}
        onChange={(value) => setSort(value as typeof sort)}
      />
      <SectionHeading
        title="Sharing tasks"
        count={rows?.length}
        description="Confirm completed shares, then work through your ready tasks."
      />
      <State
        loading={q.isLoading}
        error={q.error}
        empty={rows?.length === 0}
        emptyTitle={search ? 'No matching tasks' : 'A little breathing room'}
        emptyDescription={
          search
            ? 'Try a different group name or caption.'
            : 'No tasks in this view. Add a post to your queue or try another filter.'
        }
        retry={() => q.refetch()}
      />
      {rows?.map((t) => (
        <Card key={t.id}>
          <Row>
            <Badge text={label(t.status)} />
            {t.paused && <Badge text="Paused" />}
          </Row>
          <Txt bold size={18}>
            {t.facebook_groups?.name}
          </Txt>
          <Txt numberOfLines={2}>{t.imported_posts?.caption || 'Imported post'}</Txt>
          {t.facebook_groups?.notes && (
            <Txt muted size={12}>
              Group rules: {t.facebook_groups.notes}
            </Txt>
          )}
          {t.scheduled_at && (
            <Txt muted size={12}>
              Reminder: {new Date(t.scheduled_at).toLocaleString()}
            </Txt>
          )}
          <Txt muted size={12}>
            {t.attempt_count} attempts
            {t.confirmation_source ? ` · ${label(t.confirmation_source)}` : ''}
          </Txt>
          {t.last_error && <Txt>{t.last_error}</Txt>}
          {t.status === 'ready_for_user' && !t.paused && (
            <Row>
              <Button title="Open group" disabled={op.isPending} onPress={() => open(t)} />
              <Button
                title="Share post link"
                secondary
                disabled={op.isPending}
                onPress={() => open(t, true)}
              />
            </Row>
          )}
          {t.status === 'awaiting_confirmation' && (
            <>
              <Button title="Confirm I shared" disabled={op.isPending} onPress={() => confirm(t)} />
              <Row>
                <Button
                  title="Open group again"
                  secondary
                  onPress={() =>
                    Linking.openURL(t.facebook_groups!.url).catch(() =>
                      Alert.alert('Facebook', 'Could not open group.'),
                    )
                  }
                />
                <Button
                  title="Report failure"
                  secondary
                  disabled={op.isPending}
                  onPress={() =>
                    transition(t, 'failed', 'User reported that sharing could not be completed.')
                  }
                />
                <Button
                  title="Return to ready"
                  secondary
                  disabled={op.isPending}
                  onPress={() => transition(t, 'ready_for_user')}
                />
              </Row>
            </>
          )}
          {['pending', 'failed', 'skipped'].includes(t.status) && (
            <Button
              title={t.status === 'failed' ? 'Retry task' : 'Make ready'}
              disabled={op.isPending}
              onPress={() => transition(t, 'ready_for_user')}
            />
          )}
          <Button
            title="Open original post"
            secondary
            onPress={() =>
              Linking.openURL(t.imported_posts!.post_url).catch(() =>
                Alert.alert('Facebook', 'Could not open post.'),
              )
            }
          />
          {!['confirmed_shared', 'cancelled', 'skipped'].includes(t.status) && (
            <Row>
              <Button
                title="Skip"
                secondary
                disabled={op.isPending}
                onPress={() => transition(t, 'skipped')}
              />
              <Button
                title="Cancel task"
                secondary
                disabled={op.isPending}
                onPress={() => transition(t, 'cancelled')}
              />
            </Row>
          )}
        </Card>
      ))}
    </Screen>
  );
}
