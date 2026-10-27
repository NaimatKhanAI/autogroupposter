import { errorMessage } from '../../src/errors';
import React, { useState } from 'react';
import { Alert, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRows, useOperation } from '../../src/api';
import { Group, Page, groupSchema } from '../../src/domain';
import { Screen, Card, Txt, Button, Field, Row, State } from '../../src/ui';
export default function EditGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groups = useRows<Group>('facebook_groups');
  const initial = groups.data?.find((v) => v.id === id);
  if (id !== 'new' && (groups.isLoading || groups.error || !initial))
    return (
      <Screen title="Group preferences">
        <State
          loading={groups.isLoading}
          error={groups.error}
          empty={!initial && !groups.isLoading}
          retry={() => groups.refetch()}
        />
        <Button title="Back" secondary onPress={() => router.back()} />
      </Screen>
    );
  return <GroupForm key={id} id={id} initial={initial} />;
}
function GroupForm({ id, initial }: { id: string; initial?: Group }) {
  const pages = useRows<Page>('connected_pages');
  const op = useOperation();
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    notes: initial?.notes ?? '',
    collection: initial?.collection ?? '',
    enabled: initial?.enabled ?? true,
    page_id: initial?.page_id ?? (null as string | null),
  });
  const change = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  async function save() {
    try {
      await op.mutateAsync({
        action: 'group.save',
        id: id === 'new' ? undefined : id,
        values: groupSchema.parse(values),
      });
      router.back();
    } catch (e) {
      Alert.alert('Save group', errorMessage(e));
    }
  }
  function remove() {
    Alert.alert('Delete this group?', 'Its sharing tasks and attempts will also be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await op.mutateAsync({ action: 'group.delete', id });
            router.back();
          } catch (e) {
            Alert.alert('Delete group', errorMessage(e));
          }
        },
      },
    ]);
  }
  return (
    <Screen title={id === 'new' ? 'Add a group' : 'Group preferences'}>
      <Field label="Group name" value={values.name} onChangeText={(v) => change('name', v)} />
      <Field
        label="Facebook group URL"
        editable={id === 'new'}
        autoCapitalize="none"
        value={values.url}
        onChangeText={(v) => change('url', v)}
        placeholder="https://www.facebook.com/groups/your-group"
      />
      <Field
        label="Collection"
        value={values.collection}
        onChangeText={(v) => change('collection', v)}
      />
      <Field
        label="Posting rules & notes"
        multiline
        value={values.notes}
        onChangeText={(v) => change('notes', v)}
      />
      <Card>
        <Row>
          <Txt bold>Include in new sharing queues</Txt>
          <Switch
            accessibilityLabel="Enable group"
            value={values.enabled}
            onValueChange={(v) => change('enabled', v)}
          />
        </Row>
        <Txt muted>
          Existing tasks keep their status. New posts use enabled groups assigned to their Page.
        </Txt>
        <Txt bold>Page assignment</Txt>
        <Button
          title="All Pages"
          secondary={values.page_id !== null}
          onPress={() => change('page_id', null)}
        />
        {pages.data?.map((p) => (
          <Button
            key={p.id}
            title={p.name}
            secondary={values.page_id !== p.id}
            onPress={() => change('page_id', p.id)}
          />
        ))}
      </Card>
      <Button title="Save group" disabled={op.isPending} onPress={save} />
      {id !== 'new' && <Button title="Delete group" secondary onPress={remove} />}
      <Button title="Close" secondary onPress={() => router.back()} />
    </Screen>
  );
}
