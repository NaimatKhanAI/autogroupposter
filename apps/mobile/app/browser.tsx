import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/config/firebase';
import { Screen, Card, Txt, Button, Field, State } from '../src/ui';
async function call(action: string, input: Record<string, unknown> = {}): Promise<any> {
  return (await httpsCallable(functions, 'agpApi')({ action, input })).data;
}
export default function BrowserWorkspace() {
  const [name, setName] = useState('Mobile campaign'),
    [text, setText] = useState(''),
    [groupName, setGroupName] = useState(''),
    [url, setUrl] = useState(''),
    [device, setDevice] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const data = useQuery({
    queryKey: ['commercial-browser'],
    queryFn: async () => {
      await call('bootstrap');
      const [devices, groups, jobs] = await Promise.all(
        ['devices', 'groups', 'jobs'].map((kind) => call('list', { kind })),
      );
      return { devices, groups, jobs };
    },
    refetchInterval: 30000,
  });
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await data.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Browser workspace">
      <Card>
        <Txt bold>Same account. Same extension.</Txt>
        <Txt muted>
          Install AutoGroupPoster in Chrome, sign in with this account, and connect the browser
          under Devices. This commercial workspace is separate from your existing manual sharing
          queue.
        </Txt>
      </Card>
      <State loading={data.isLoading} error={data.error} retry={() => data.refetch()} />
      {!!error && <Txt>{error}</Txt>}
      <Card>
        <Txt bold>Connected browsers</Txt>
        {data.data?.devices
          .filter((d: any) => !d.revoked)
          .map((d: any) => (
            <React.Fragment key={d.id}>
              <Button
                secondary
                title={`${device === d.id ? '✓ ' : ''}${d.name}`}
                onPress={() => setDevice(d.id)}
              />
              <Txt muted>
                Last seen {new Date(d.lastSeen).toLocaleString()}. Offline browsers leave jobs
                pending.
              </Txt>
              <Button
                secondary
                title="Revoke browser"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await call('revokeDevice', { id: d.id });
                  })
                }
              />
            </React.Fragment>
          ))}
      </Card>
      <Card>
        <Txt bold>Add a destination</Txt>
        <Field label="Group name" value={groupName} onChangeText={setGroupName} />
        <Field label="HTTPS group URL" value={url} onChangeText={setUrl} />
        <Button
          title="Save group"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await call('saveGroup', { name: groupName, url, category: 'Mobile' });
              setGroupName('');
              setUrl('');
            })
          }
        />
      </Card>
      <Card>
        <Txt bold>Prepare a campaign</Txt>
        <Field label="Campaign title" value={name} onChangeText={setName} />
        <Field label="Draft text" value={text} onChangeText={setText} multiline />
        {data.data?.groups.map((g: any) => (
          <Button
            secondary
            key={g.id}
            title={`${selected.includes(g.id) ? '✓ ' : ''}${g.name}`}
            onPress={() =>
              setSelected(
                selected.includes(g.id)
                  ? selected.filter((id) => id !== g.id)
                  : [...selected, g.id],
              )
            }
          />
        ))}
        <Button
          title="Send preparation to browser"
          disabled={busy || !device || !selected.length || !text}
          onPress={() =>
            void run(async () => {
              const p = await call('savePost', { title: name, text, media: [], template: false });
              await call('createCampaign', {
                requestId: `mobile_${Date.now()}`,
                name,
                postId: p.id,
                groupIds: selected,
                deviceId: device,
              });
              setText('');
            })
          }
        />
      </Card>
      <Card>
        <Txt bold>Live task status</Txt>
        {data.data?.jobs.map((j: any) => (
          <React.Fragment key={j.id}>
            <Txt>
              {j.group.name}: {j.status.replaceAll('_', ' ')}
            </Txt>
            {['prepared', 'waiting_for_user', 'failed'].includes(j.status) && (
              <Button
                title="Cancel task"
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await call('transitionJob', { id: j.id, status: 'cancelled' });
                  })
                }
              />
            )}
          </React.Fragment>
        ))}
      </Card>
    </Screen>
  );
}
