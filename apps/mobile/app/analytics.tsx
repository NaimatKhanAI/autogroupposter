import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { operation } from '../src/api';
import { Screen, Card, Txt, Button, Row, State, styles, useTheme } from '../src/ui';
interface AnalyticsData {
  posts: number;
  groups: number;
  pages: number;
  tasks: number;
  confirmed: number;
  pending: number;
  failed: number;
  week: number;
  month: number;
  daily: { day: string; total: number }[];
  per_group: { name: string; tasks: number; confirmed: number }[];
  per_page: { name: string; posts: number }[];
}
export default function Analytics() {
  const t = useTheme();
  const q = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => operation('analytics'),
  });
  const a = q.data;
  const max = Math.max(1, ...(a?.daily.map((v) => v.total) ?? []));
  return (
    <Screen title="Workspace analytics" onRefresh={() => q.refetch()} refresh={q.isRefetching}>
      <Txt muted>
        Operational activity, based on your imported posts and recorded confirmations.
      </Txt>
      <State loading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      {a && (
        <>
          <View style={styles.grid}>
            {[
              ['Imported posts', a.posts],
              ['Tasks created', a.tasks],
              ['Confirmed by users', a.confirmed],
              ['Pending', a.pending],
              ['Failed', a.failed],
              ['Completion', `${a.tasks ? Math.round((a.confirmed / a.tasks) * 100) : 0}%`],
            ].map(([name, value]) => (
              <Card key={name} style={styles.stat}>
                <Txt muted size={12}>
                  {name}
                </Txt>
                <Txt bold size={28}>
                  {value}
                </Txt>
              </Card>
            ))}
          </View>
          <Card>
            <Txt bold>Daily activity · last 30 days (UTC)</Txt>
            {a.daily.map((d) => (
              <Row key={d.day}>
                <Txt muted size={11} style={{ width: 70 }}>
                  {d.day.slice(5)}
                </Txt>
                <View
                  style={{
                    height: 14,
                    width: `${Math.max(2, (d.total / max) * 60)}%`,
                    borderRadius: 4,
                    backgroundColor: t.accent,
                  }}
                />
                <Txt size={12}>{d.total}</Txt>
              </Row>
            ))}
            {!a.daily.length && <Txt muted>No activity yet.</Txt>}
            <Txt muted>
              7 days: {a.week} events · 30 days: {a.month} events
            </Txt>
          </Card>
          <Txt bold size={18}>
            Per group
          </Txt>
          {a.per_group.map((g, i) => (
            <Card key={i}>
              <Txt bold>{g.name}</Txt>
              <Txt muted>
                {g.confirmed} confirmed / {g.tasks} tasks
              </Txt>
            </Card>
          ))}
          <Txt bold size={18}>
            Per Page
          </Txt>
          {a.per_page.map((p, i) => (
            <Card key={i}>
              <Txt bold>{p.name}</Txt>
              <Txt muted>{p.posts} imported posts</Txt>
            </Card>
          ))}
          <Txt muted size={12}>
            No Facebook engagement metrics are collected or estimated.
          </Txt>
        </>
      )}
      <Button title="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
