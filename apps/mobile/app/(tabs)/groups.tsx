import { errorMessage } from '../../src/errors';
import React, { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { useRows, useOperation } from '../../src/api';
import { Group, groupSchema } from '../../src/domain';
import { filterGroups, toggleVisibleSelection } from '../../src/workspace';
import { SummaryStrip, SectionHeading } from '../../src/workspaceUi';
import {
  Screen,
  Card,
  Txt,
  Button,
  Field,
  Row,
  Badge,
  State,
  FilterBar,
  useTheme,
} from '../../src/ui';
export default function Groups() {
  const theme = useTheme();
  const q = useRows<Group>('facebook_groups');
  const op = useOperation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [collection, setCollection] = useState('');
  const [sort, setSort] = useState<'name' | 'least_shared'>('name');
  const collections = [...new Set((q.data ?? []).map((g) => g.collection).filter(Boolean))].sort();
  const rows =
    q.data &&
    filterGroups(q.data, search, collection, sort).filter(
      (g) => filter === 'all' || g.enabled === (filter === 'active'),
    );
  const selectedIds = selected.filter((id) => q.data?.some((g) => g.id === id));
  async function bulk(enabled: boolean) {
    try {
      await op.mutateAsync({ action: 'group.bulk', ids: selectedIds, enabled });
      setSelected([]);
    } catch (e) {
      Alert.alert('Groups', errorMessage(e));
    }
  }
  async function importCsv() {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });
      if (pick.canceled) return;
      const file = new File(pick.assets[0]!.uri);
      if (file.size > 1000000) throw new Error('CSV must be smaller than 1 MB.');
      const parsed = Papa.parse<Record<string, string>>(await file.text(), {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length) throw new Error('CSV contains invalid rows.');
      const rows = parsed.data.map((row) =>
        groupSchema.parse({
          name: row.name,
          url: row.url,
          notes: row.notes ?? '',
          collection: row.collection ?? '',
          enabled: row.enabled !== 'false',
          page_id: row.page_id || null,
        }),
      );
      await op.mutateAsync({ action: 'group.import', rows });
      Alert.alert('Import complete', `${rows.length} groups imported. Existing URLs were updated.`);
    } catch (e) {
      Alert.alert('CSV import', errorMessage(e));
    }
  }
  async function exportCsv() {
    try {
      const file = new File(Paths.cache, 'groupposter-groups.csv');
      file.write(
        Papa.unparse(
          (q.data ?? []).map(({ name, url, notes, collection, enabled, page_id }) => ({
            name,
            url,
            notes,
            collection,
            enabled,
            page_id,
          })),
        ),
      );
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
      else throw new Error('Sharing is unavailable on this device.');
    } catch (e) {
      Alert.alert('Export', errorMessage(e));
    }
  }
  return (
    <Screen
      title="Your groups"
      subtitle="Your communities, organized around you."
      onRefresh={() => q.refetch()}
      refresh={q.isRefetching}
    >
      {!q.isLoading && !q.error && (
        <SummaryStrip
          items={[
            { label: 'Saved groups', value: q.data?.length ?? 0, icon: 'people-outline' },
            {
              label: 'Active',
              value: q.data?.filter((g) => g.enabled).length ?? 0,
              icon: 'checkmark-circle-outline',
            },
            { label: 'Collections', value: collections.length, icon: 'albums-outline' },
          ]}
        />
      )}
      <Row>
        <Button title="Add group" icon="add" onPress={() => router.push('/group/new')} />
        <Button title="Import CSV" secondary onPress={importCsv} />
        <Button title="Export" secondary onPress={exportCsv} />
      </Row>
      <Field
        label="Search groups"
        placeholder="Name, collection, or posting rules"
        value={search}
        onChangeText={setSearch}
      />
      <FilterBar
        values={[
          { key: 'all', title: 'All groups' },
          { key: 'active', title: 'Active' },
          { key: 'inactive', title: 'Inactive' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {collections.length > 0 && (
        <FilterBar
          values={[
            { key: '', title: 'All collections' },
            ...collections.map((name) => ({ key: name, title: name })),
          ]}
          value={collection}
          onChange={setCollection}
        />
      )}
      <FilterBar
        values={[
          { key: 'name', title: 'Name A–Z' },
          { key: 'least_shared', title: 'Least recently shared' },
        ]}
        value={sort}
        onChange={(value) => setSort(value as typeof sort)}
      />
      <SectionHeading
        title="Group directory"
        count={rows?.length}
        description="Select groups to manage their availability together."
      />
      {!!rows?.length && (
        <Button
          title={
            rows.every((g) => selectedIds.includes(g.id))
              ? 'Deselect visible groups'
              : 'Select visible groups'
          }
          secondary
          onPress={() =>
            setSelected((ids) =>
              toggleVisibleSelection(
                ids,
                rows.map((g) => g.id),
              ),
            )
          }
        />
      )}
      {selectedIds.length > 0 && (
        <Card>
          <Txt bold>{selectedIds.length} selected across all filters</Txt>
          <Row>
            <Button title="Activate" disabled={op.isPending} onPress={() => bulk(true)} />
            <Button
              title="Deactivate"
              secondary
              disabled={op.isPending}
              onPress={() => bulk(false)}
            />
            <Button title="Clear" secondary onPress={() => setSelected([])} />
          </Row>
        </Card>
      )}
      <State
        loading={q.isLoading}
        error={q.error}
        empty={rows?.length === 0}
        emptyTitle={
          search || collection || filter !== 'all' ? 'No matching groups' : 'Find your people'
        }
        emptyDescription={
          search || collection || filter !== 'all'
            ? 'Try another search or filter.'
            : 'Save your Facebook groups and their posting rules in one place.'
        }
        retry={() => q.refetch()}
      />
      {rows?.map((g) => (
        <Card key={g.id}>
          <Row>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(g.id) }}
              accessibilityLabel={`Select ${g.name}`}
              style={{ minWidth: 48, minHeight: 48, justifyContent: 'center' }}
              onPress={() =>
                setSelected((ids) =>
                  ids.includes(g.id) ? ids.filter((id) => id !== g.id) : [...ids, g.id],
                )
              }
            >
              <Ionicons
                name={selected.includes(g.id) ? 'checkbox' : 'square-outline'}
                size={24}
                color={theme.accent}
              />
            </Pressable>
            <Txt bold size={17} style={{ flex: 1 }}>
              {g.name}
            </Txt>
            <Badge text={g.enabled ? 'Active' : 'Inactive'} />
          </Row>
          {g.collection && (
            <Txt muted size={12}>
              {g.collection}
            </Txt>
          )}
          <Txt muted numberOfLines={2}>
            {g.notes || 'No posting rules added.'}
          </Txt>
          <Txt muted size={12}>
            Last confirmed:{' '}
            {g.last_shared_at ? new Date(g.last_shared_at).toLocaleDateString() : 'Never'}
          </Txt>
          <Button
            title="Edit group & preferences"
            secondary
            onPress={() => router.push(`/group/${g.id}`)}
          />
        </Card>
      ))}
    </Screen>
  );
}
