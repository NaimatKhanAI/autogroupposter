import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
const draftSchema = z.object({
  page: z.string().max(128), url: z.string().max(2048), caption: z.string().max(10000),
  mediaType: z.enum(['text','link','image','video']).default('link'), savedAt: z.string().datetime(),
});
export type ImportDraft = z.infer<typeof draftSchema>;
const pending = new Map<string, Promise<unknown>>();
const key = (owner: string) => { if (!owner) throw new Error('Sign in to save a draft.'); return `groupposter:import-draft:v1:${owner}`; };
function ordered<T>(owner: string, action: () => Promise<T>): Promise<T> {
  const previous = pending.get(owner) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  pending.set(owner,next);
  void next.finally(() => { if (pending.get(owner) === next) pending.delete(owner); }).catch(() => {});
  return next;
}
export async function loadImportDraft(owner: string): Promise<ImportDraft | null> {
  return ordered(owner, async () => {
    const raw = await AsyncStorage.getItem(key(owner));
    if (!raw) return null;
    try { return draftSchema.parse(JSON.parse(raw)); }
    catch { await AsyncStorage.removeItem(key(owner)); return null; }
  });
}
export function saveImportDraft(owner: string, draft: ImportDraft) {
  const valid = draftSchema.parse(draft);
  return ordered(owner, () => AsyncStorage.setItem(key(owner),JSON.stringify(valid)));
}
export function clearImportDraft(owner: string) {
  return ordered(owner, () => AsyncStorage.removeItem(key(owner)));
}
