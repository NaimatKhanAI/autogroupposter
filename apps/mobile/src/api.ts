import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFreeBackend, normalize } from './firebaseOperations';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, configured, functions } from './config/firebase';
import { httpsCallable } from 'firebase/functions';
import NetInfo from '@react-native-community/netinfo';
const backend = createFreeBackend(db, auth,async()=>{const call=httpsCallable(functions,'agpApi');await call({action:'bootstrap',input:{}});await call({action:'deleteAccountRequest',input:{message:'Please delete my account and associated data, including billing cancellation.'}});});
export async function operation(action: string, payload: Record<string, unknown> = {}) {
  if (!configured) throw new Error('Configure Firebase in .env and restart Expo.');
  const network = await NetInfo.fetch();
  if (network.isConnected === false || network.isInternetReachable === false)
    throw new Error("You're offline. Reconnect and try again.");
  return backend.operation(action, payload);
}
export interface Profile {
  display_name: string;
  timezone: string;
  appearance: 'system' | 'light' | 'dark';
  notifications_enabled: boolean;
  posting_window_start: string;
  posting_window_end: string;
}
export async function getProfile(): Promise<Profile> {
  if (!auth.currentUser) throw new Error('Session expired');
  return operation('profile.ensure', { display_name: auth.currentUser.displayName ?? '' });
}
export async function readRows(table: string): Promise<Record<string, any>[]> {
  return backend.rows(table);
}
export function useRows<T>(table: string, select = '*') {
  return useQuery({
    queryKey: [table, select],
    queryFn: async () => {
      const rows = await readRows(table);
      const relations = ['connected_pages', 'facebook_groups', 'imported_posts'];
      const cache = new Map<string, Promise<Record<string, unknown> | null>>();
      await Promise.all(
        rows.map(async (row) => {
          for (const relation of relations) {
            if (!select.includes(relation + '(')) continue;
            const key =
              relation === 'connected_pages'
                ? 'page_id'
                : relation === 'facebook_groups'
                  ? 'group_id'
                  : 'post_id';
            if (!row[key]) continue;
            const path = relation + '/' + row[key];
            if (!cache.has(path))
              cache.set(
                path,
                getDoc(doc(db, path)).then((d) =>
                  d.exists() ? { ...normalize(d.data()), id: d.id } : null,
                ),
              );
            row[relation] = await cache.get(path);
          }
        }),
      );
      return rows as T[];
    },
  });
}
export function useOperation() {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ action, ...payload }: { action: string; [key: string]: unknown }) =>
      operation(action, payload),
    onSuccess: () => client.invalidateQueries(),
  });
}
