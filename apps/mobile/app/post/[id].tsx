import { errorMessage } from '../../src/errors';
import React, { useState } from 'react';
import { ReminderPicker } from '../../src/ReminderPicker';
import { Alert, Image, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRows, useOperation } from '../../src/api';
import { Post, Task, Group, label } from '../../src/domain';
import { Screen, Card, Txt, Button, Row, State, Badge, Field } from '../../src/ui';
import {
  filterGroups,
  reminderDate,
  selectableGroups,
  toggleVisibleSelection,
} from '../../src/workspace';
import { ChoiceCard, SectionHeading } from '../../src/workspaceUi';
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const posts = useRows<Post>('imported_posts', '*, connected_pages(name)');
  const groups = useRows<Group>('facebook_groups');
  const tasks = useRows<Task>('sharing_tasks', '*, facebook_groups(*)');
  const op = useOperation();
  const [selected, setSelected] = useState<string[]>([]);
  const [when, setWhen] = useState('');
  const [search, setSearch] = useState('');
  const post = posts.data?.find((p) => p.id === id);
  const assigned = tasks.data?.filter((t) => t.post_id === id);
  const eligible = post
    ? selectableGroups(groups.data ?? [], tasks.data ?? [], id, post.page_id)
    : [];
  const visible = filterGroups(eligible, search);
  const selectedIds = selected.filter((value) => eligible.some((g) => g.id === value));
  async function queue() {
    try {
      const scheduled_at = reminderDate(when);
      if (groups.isLoading || tasks.isLoading || groups.error || tasks.error || !selectedIds.length)
        throw new Error(
          'Wait for groups and sharing history to load, then select available groups.',
        );
      await op.mutateAsync({
        action: 'queue.add',
        post_id: id,
        group_ids: selectedIds,
        scheduled_at,
      });
      Alert.alert('Queue updated', 'Existing post/group tasks are preserved.');
      setSelected([]);
    } catch (e) {
      Alert.alert('Sharing queue', errorMessage(e));
    }
  }
  return (
    <Screen title="Post details">
      <State loading={posts.isLoading} error={posts.error} empty={!posts.isLoading && !post} />
      {post && (
        <>
          <Card>
            {post.image_url && (
              <Image source={{ uri: post.image_url }} style={{ height: 220, borderRadius: 12 }} />
            )}
            <Badge text={post.media_type} />
            <Txt bold size={20}>
              {post.connected_pages?.name}
            </Txt>
            <Txt>{post.caption || 'No caption provided'}</Txt>
            <Txt muted size={12}>
              {new Date(post.published_at).toLocaleString()} · ID{' '}
              {post.facebook_post_id || 'Manual import'}
            </Txt>
            <Txt muted selectable size={12}>
              {post.post_url}
            </Txt>
            <Txt bold>
              {assigned?.length ?? 0} groups ·{' '}
              {assigned?.filter((t) => t.status === 'confirmed_shared').length ?? 0} confirmed
            </Txt>
            <Row>
              <Button
                title="Copy link"
                secondary
                onPress={() =>
                  Clipboard.setStringAsync(post.post_url)
                    .then(() => Alert.alert('Copied', 'Post link copied.'))
                    .catch((e) => Alert.alert('Copy', e.message))
                }
              />
              <Button
                title="Open Facebook"
                secondary
                onPress={() =>
                  Linking.openURL(post.post_url).catch(() =>
                    Alert.alert('Open post', 'Could not open Facebook.'),
                  )
                }
              />
            </Row>
          </Card>
          <SectionHeading
            title="Choose groups"
            count={eligible.length}
            description={`${selectedIds.length} selected. Groups already in this post's history are excluded.`}
          />
          <Txt muted>Sharing is completed by you on Facebook. A schedule creates a reminder.</Txt>
          <State
            loading={groups.isLoading || tasks.isLoading}
            error={groups.error || tasks.error}
            retry={() => {
              void groups.refetch();
              void tasks.refetch();
            }}
          />
          {!groups.isLoading && !tasks.isLoading && !groups.error && !tasks.error && (
            <>
              <Field
                label="Find groups"
                placeholder="Search name, collection, or rules"
                value={search}
                onChangeText={setSearch}
              />
              {!!visible.length && (
                <Button
                  title={
                    visible.every((g) => selectedIds.includes(g.id))
                      ? 'Deselect visible groups'
                      : 'Select visible groups'
                  }
                  secondary
                  onPress={() =>
                    setSelected((ids) =>
                      toggleVisibleSelection(
                        ids,
                        visible.map((g) => g.id),
                      ),
                    )
                  }
                />
              )}
              <State
                empty={!visible.length}
                emptyTitle={search ? 'No matching groups' : 'No available groups'}
                emptyDescription={
                  search
                    ? 'Try a different name or collection.'
                    : 'Add an active group for this Page. Groups already assigned to this post appear in sharing history.'
                }
              />
              {visible.map((g) => (
                <ChoiceCard
                  key={g.id}
                  title={g.name}
                  description={
                    [g.collection, g.notes].filter(Boolean).join(' · ') || 'No posting rules added'
                  }
                  selected={selectedIds.includes(g.id)}
                  onPress={() => setSelected((ids) => toggleVisibleSelection(ids, [g.id]))}
                />
              ))}
            </>
          )}
          <ReminderPicker value={when} onChange={setWhen} />
          <Txt muted size={12}>
            Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Include an offset;
            reminders are stored in UTC.
          </Txt>
          <Button
            title={when ? 'Schedule selected groups' : 'Add selected groups to queue'}
            disabled={
              !selectedIds.length ||
              op.isPending ||
              groups.isLoading ||
              tasks.isLoading ||
              !!groups.error ||
              !!tasks.error
            }
            onPress={queue}
          />
          <Txt bold size={18}>
            Sharing history
          </Txt>
          {assigned?.map((task) => (
            <Card key={task.id}>
              <Txt bold>{task.facebook_groups?.name}</Txt>
              <Badge text={label(task.status)} />
              <Txt muted>
                {task.attempt_count} attempts ·{' '}
                {task.confirmation_source ? label(task.confirmation_source) : 'Unconfirmed'}
              </Txt>
              {task.last_error && <Txt>{task.last_error}</Txt>}
            </Card>
          ))}
          <Button title="Open sharing queue" secondary onPress={() => router.push('/queue')} />
        </>
      )}
      <Button title="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
