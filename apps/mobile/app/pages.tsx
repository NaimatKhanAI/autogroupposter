import { errorMessage } from '../src/errors';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { Page } from '../src/domain';
import { useRows, useOperation } from '../src/api';
import { Screen, Card, Txt, Button, Field, Row, Badge, State, useTheme } from '../src/ui';
export default function Pages() {
  const q = useRows<Page>('connected_pages'),
    op = useOperation(),
    t = useTheme();
  const [name, setName] = useState(''),
    [pageId, setId] = useState(''),
    [error, setError] = useState('');
  async function act(action: string, id?: string) {
    setError('');
    try {
      await op.mutateAsync({
        action,
        id,
        values: { name: name.trim(), facebook_page_id: pageId.trim() },
      });
      if (action === 'page.add') {
        setName('');
        setId('');
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Screen title="Your Pages" subtitle="Keep each post connected to its source.">
      <State loading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      {q.data?.map((p) => (
        <Card key={p.id}>
          <Txt bold size={19}>
            {p.name}
          </Txt>
          <Txt muted size={12} selectable>
            Page ID: {p.facebook_page_id}
          </Txt>
          <Row>
            <Badge text="Saved Page" />
            {p.is_default && <Badge text="Default" />}
          </Row>
          <Row>
            <Button
              title={p.is_default ? 'Default Page' : 'Make default'}
              disabled={op.isPending || p.is_default}
              secondary
              onPress={() => act('page.default', p.id)}
            />
            <Button
              title="View posts"
              secondary
              onPress={() => router.push({ pathname: '/posts', params: { page_id: p.id } })}
            />
          </Row>
        </Card>
      ))}
      <Card>
        <Txt bold size={18}>
          Add a Facebook Page
        </Txt>
        <Txt muted size={13}>
          Save the name and numeric ID of a Page you manage. You can then import its published posts
          here. This does not connect to your Facebook account.
        </Txt>
        <Field
          label="Page name"
          placeholder="Your Page name"
          value={name}
          onChangeText={setName}
          editable={!op.isPending}
        />
        <Field
          label="Facebook Page ID"
          placeholder="Numeric Page ID"
          value={pageId}
          onChangeText={setId}
          keyboardType="number-pad"
          editable={!op.isPending}
        />
        {!!error && (
          <Txt color={t.danger} size={13} accessibilityLiveRegion="polite">
            {error}
          </Txt>
        )}
        <Button
          title="Save Page"
          icon="add-outline"
          loading={op.isPending}
          onPress={() => act('page.add')}
        />
      </Card>
      <Button title="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
