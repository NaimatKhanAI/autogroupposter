import React, { useState } from 'react';
import { router } from 'expo-router';
import { useRows } from '../src/api';
import { label } from '../src/domain';
import { Screen, Card, Txt, Button, Field, Badge, State } from '../src/ui';
export default function Activity() {
  const q = useRows<{
    id: string;
    event_type: string;
    source: string;
    status: string;
    detail: string | null;
    created_at: string;
    post_id: string | null;
    group_id: string | null;
  }>('audit_logs');
  const [search, setSearch] = useState('');
  const rows = q.data?.filter((v) => `${v.event_type} ${v.status} ${v.source}`.includes(search));
  return (
    <Screen title="Activity history" onRefresh={() => q.refetch()} refresh={q.isRefetching}>
      <Field label="Search events" value={search} onChangeText={setSearch} />
      <State
        loading={q.isLoading}
        error={q.error}
        empty={rows?.length === 0}
        retry={() => q.refetch()}
      />
      {rows?.map((v) => (
        <Card key={v.id}>
          <Txt bold>{label(v.event_type.replaceAll('.', ' '))}</Txt>
          <Badge text={v.status || 'Recorded'} />
          <Txt muted size={12}>
            {new Date(v.created_at).toLocaleString()} · {v.source}
          </Txt>
          {v.detail && <Txt>{v.detail}</Txt>}
          {v.group_id && (
            <Txt muted size={11}>
              Group {v.group_id}
            </Txt>
          )}
          {v.post_id && (
            <Button
              title="View related post"
              secondary
              onPress={() => router.push(`/post/${v.post_id}`)}
            />
          )}
        </Card>
      ))}
      <Button title="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
