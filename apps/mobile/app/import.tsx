import { errorMessage } from '../src/errors';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useRows, useOperation } from '../src/api';
import { Page, postSchema } from '../src/domain';
import { Screen, Card, Txt, Button, Field, Row } from '../src/ui';
export default function Import() {
  const pages = useRows<Page>('connected_pages');
  const op = useOperation();
  const [page, setPage] = useState('');
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  async function save() {
    try {
      const values = postSchema.parse({
        page_id: page || pages.data?.find((p) => p.is_default)?.id || pages.data?.[0]?.id,
        post_url: url,
        caption,
      });
      const post = await op.mutateAsync({ action: 'post.import', values });
      router.replace(`/post/${post.id}`);
    } catch (e) {
      Alert.alert('Import post', errorMessage(e));
    }
  }
  return (
    <Screen title="Import a post">
      <Txt muted>
        Bring in an existing Page post. Importing never publishes a new Facebook post.
      </Txt>
      <Card>
        <Txt bold>Select a Page</Txt>
        <Row>
          {pages.data?.map((p) => (
            <Button
              key={p.id}
              title={p.name}
              secondary={page !== p.id}
              onPress={() => setPage(p.id)}
            />
          ))}
        </Row>
        {!pages.data?.length && (
          <Button title="Configure a Page first" secondary onPress={() => router.push('/pages')} />
        )}
      </Card>
      <Field
        label="Facebook post URL"
        autoCapitalize="none"
        value={url}
        onChangeText={setUrl}
        placeholder="https://www.facebook.com/…"
      />
      <Field label="Caption" multiline value={caption} onChangeText={setCaption} />
      <Button
        title="Import existing post"
        disabled={op.isPending || !pages.data?.length}
        onPress={save}
      />
      <Button title="Cancel" secondary onPress={() => router.back()} />
    </Screen>
  );
}
