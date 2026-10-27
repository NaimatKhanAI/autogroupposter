import React, { useState } from 'react';
import { Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRows } from '../../src/api';
import { Post } from '../../src/domain';
import { Screen, Card, Txt, Button, Field, Badge, State } from '../../src/ui';
export default function Posts() {
  const { page_id } = useLocalSearchParams<{ page_id?: string }>();
  const q = useRows<Post>('imported_posts', '*, connected_pages(name)');
  const [search, setSearch] = useState('');
  const rows = q.data?.filter(
    (p) =>
      (!page_id || p.page_id === page_id) &&
      `${p.caption} ${p.connected_pages?.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Screen
      title="Your posts"
      subtitle="From published content to your next share."
      onRefresh={() => q.refetch()}
      refresh={q.isRefetching}
    >
      <Button title="Import a post" icon="add" onPress={() => router.push('/import')} />
      {page_id && (
        <Button
          title="Show all Pages"
          secondary
          onPress={() => router.setParams({ page_id: '' })}
        />
      )}
      <Field
        label="Search posts"
        placeholder="Caption or Page name"
        value={search}
        onChangeText={setSearch}
      />
      <State
        loading={q.isLoading}
        error={q.error}
        empty={rows?.length === 0}
        emptyTitle={search ? 'No matching posts' : 'Build your post library'}
        emptyDescription={
          search
            ? 'Try a different caption or Page name.'
            : 'Import a published Facebook Page post to start your library.'
        }
        retry={() => q.refetch()}
      />
      {rows?.map((p) => (
        <Card key={p.id}>
          {p.image_url && (
            <Image
              source={{ uri: p.image_url }}
              style={{ height: 180, borderRadius: 12 }}
              accessibilityLabel="Post media preview"
            />
          )}
          <Badge text={p.media_type.toUpperCase()} />
          <Txt bold>{p.connected_pages?.name}</Txt>
          <Txt numberOfLines={4}>{p.caption || 'No caption provided'}</Txt>
          <Txt muted size={12}>
            {new Date(p.published_at).toLocaleString()}
          </Txt>
          <Button title="Manage post" secondary onPress={() => router.push(`/post/${p.id}`)} />
        </Card>
      ))}
    </Screen>
  );
}
