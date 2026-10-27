import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRows, operation } from '../../src/api';
import { auth } from '../../src/config/firebase';
import { Post, Task } from '../../src/domain';
import { Screen, Card, Txt, Button, Row, Badge, State, styles, useTheme } from '../../src/ui';
export default function Dashboard() {
  const posts = useRows<Post>('imported_posts', '*, connected_pages(name)');
  const tasks = useRows<Task>('sharing_tasks');
  const client = useQueryClient();
  const t = useTheme();
  const metrics = useQuery({ queryKey: ['analytics'], queryFn: () => operation('analytics') });
  const a = metrics.data;
  const name = auth.currentUser?.displayName?.trim().split(' ')[0];
  const upcoming = tasks.data
    ?.filter((v) => v.status === 'scheduled' && !v.paused)
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
    .slice(0, 3);
  const progress = a?.tasks ? Math.min(100, Math.round((a.confirmed / a.tasks) * 100)) : 0;
  const stats = [
    { title: 'Page posts', value: a?.posts, icon: 'documents-outline' },
    { title: 'Saved groups', value: a?.groups, icon: 'people-outline' },
    { title: 'Confirmed shares', value: a?.confirmed, icon: 'checkmark-done-outline' },
    { title: 'Need attention', value: a?.pending, icon: 'time-outline' },
  ] as const;
  return (
    <Screen
      title={name ? `Hello, ${name}` : 'Your overview'}
      subtitle="A clear view of what comes next."
      eyebrow={new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
        .format(new Date())
        .toUpperCase()}
      onRefresh={() => client.invalidateQueries()}
      refresh={metrics.isRefetching}
    >
      <Card style={{ backgroundColor: t.hero, borderColor: t.hero, gap: 17, padding: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sparkles-outline" size={15} color="#99DAC8" />
          <Txt size={10} bold color="#99DAC8" style={{ letterSpacing: 1.7 }}>
            YOUR NEXT MOVE
          </Txt>
        </View>
        <Txt bold size={25} color="#FFFFFF">
          {a?.pending
            ? `${a.pending} tasks.\nOne focused next step.`
            : 'Less scrolling.\nMore purposeful sharing.'}
        </Txt>
        <Txt size={13} color="#C4DDD6">
          Keep your posts organized and your group sharing on track.
        </Txt>
        <Button
          title={a && !a.groups ? 'Add your first group' : 'Open sharing queue'}
          icon="arrow-forward"
          onPress={() => router.push(a && !a.groups ? '/group/new' : '/queue')}
        />
      </Card>
      <State
        loading={metrics.isLoading}
        error={metrics.error || posts.error || tasks.error}
        retry={() => client.invalidateQueries()}
      />
      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.title} style={styles.stat}>
            <View
              style={{
                width: 35,
                height: 35,
                borderRadius: 12,
                backgroundColor: t.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={s.icon} size={18} color={t.accent} />
            </View>
            <Txt bold size={29}>
              {s.value ?? '�'}
            </Txt>
            <Txt muted size={12}>
              {s.title}
            </Txt>
          </Card>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        <Txt bold size={17}>
          Quick actions
        </Txt>
        <Row>
          <Button
            title="Add group"
            secondary
            icon="add-outline"
            onPress={() => router.push('/group/new')}
          />
          <Button
            title="Import post"
            secondary
            icon="link-outline"
            onPress={() => router.push('/import')}
          />
          <Button
            title="Manage Pages"
            secondary
            icon="flag-outline"
            onPress={() => router.push('/pages')}
          />
        </Row>
      </View>
      <Card>
        <Row>
          <Txt bold>Sharing progress</Txt>
          <Badge text={a ? `${progress}% complete` : 'Loading'} />
        </Row>
        <View style={{ height: 8, borderRadius: 5, backgroundColor: t.line, overflow: 'hidden' }}>
          <View
            style={{ height: 8, borderRadius: 5, backgroundColor: t.accent, width: `${progress}%` }}
          />
        </View>
        <Txt muted size={12}>
          {a
            ? `${a.confirmed} of ${a.tasks} tasks confirmed by you.`
            : 'Your progress will appear when your workspace loads.'}
        </Txt>
        <Txt muted size={11}>
          Based on your confirmations. Facebook publication is not independently verified.
        </Txt>
      </Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt bold size={17}>
          Recent posts
        </Txt>
        <Button title="View all" secondary onPress={() => router.push('/posts')} />
      </View>
      <State
        loading={posts.isLoading}
        empty={posts.data?.length === 0}
        emptyTitle="Your first post starts here"
        emptyDescription="Import a published Page post to start organizing your sharing."
        emptyAction={{ title: 'Import a post', onPress: () => router.push('/import') }}
      />
      {posts.data?.slice(0, 3).map((p) => (
        <Card key={p.id}>
          <Badge text={p.media_type || 'Page post'} />
          <Txt bold size={16}>
            {p.connected_pages?.name ?? 'Page post'}
          </Txt>
          <Txt muted numberOfLines={3}>
            {p.caption || 'Imported Facebook post'}
          </Txt>
          <Txt muted size={11}>
            {new Date(p.published_at).toLocaleString()}
          </Txt>
          <Button
            title="View post"
            secondary
            icon="arrow-forward-outline"
            onPress={() => router.push(`/post/${p.id}`)}
          />
        </Card>
      ))}
      <Txt bold size={17}>
        Coming up
      </Txt>
      {upcoming?.map((task) => (
        <Card key={task.id}>
          <Row>
            <Ionicons name="calendar-outline" size={20} color={t.accent} />
            <Txt bold>{new Date(task.scheduled_at!).toLocaleString()}</Txt>
          </Row>
          <Button title="View reminder" secondary onPress={() => router.push('/queue')} />
        </Card>
      ))}
      {!tasks.isLoading && !tasks.error && !upcoming?.length && (
        <Card>
          <Txt muted size={13}>
            No reminders scheduled. Set a time from a post when you are ready.
          </Txt>
        </Card>
      )}
      <Row>
        <Button
          title="Analytics"
          secondary
          icon="bar-chart-outline"
          onPress={() => router.push('/analytics')}
        />
        <Button
          title="Activity"
          secondary
          icon="pulse-outline"
          onPress={() => router.push('/activity')}
        />
        <Button title="Pages" secondary icon="flag-outline" onPress={() => router.push('/pages')} />
      </Row>
    </Screen>
  );
}
