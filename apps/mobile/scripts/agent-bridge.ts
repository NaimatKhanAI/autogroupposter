import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore, terminate } from 'firebase/firestore';
import { createFreeBackend } from '../src/firebaseOperations';
import { ensureMembership } from '../src/membershipApi';
import { bridgeConfigSchema, createAgentBridge, createAgentIntake } from './lib/agentBridge';

async function main() {
  const required = (name: string): string => {
    // This is a Node server; Expo's compile-time environment replacement is not used.
    // eslint-disable-next-line expo/no-dynamic-env-var
    const value = process.env[name];
    if (!value) throw new Error(`Set ${name} in the private bridge environment.`);
    return value;
  };
  const token = required('GROUPPOSTER_BRIDGE_TOKEN');
  if (token.length < 32) throw new Error('Use a bridge token with at least 32 characters.');
  const config = bridgeConfigSchema.parse({
    pageId: required('GROUPPOSTER_BRIDGE_PAGE_ID'),
    groupIds: (process.env.GROUPPOSTER_BRIDGE_GROUP_IDS ?? '')
      .split(',')
      .map((v: string) => v.trim())
      .filter(Boolean),
  });
  const port = Number(process.env.GROUPPOSTER_BRIDGE_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid bridge port.');
  const app = initializeApp(
    {
      apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY'),
      appId: required('EXPO_PUBLIC_FIREBASE_APP_ID'),
      projectId: 'groupposter-1f253',
      authDomain: 'groupposter-1f253.firebaseapp.com',
    },
    'agent-bridge',
  );
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  try {
    const { user } = await signInWithEmailAndPassword(
      auth,
      required('GROUPPOSTER_BRIDGE_EMAIL'),
      required('GROUPPOSTER_BRIDGE_PASSWORD'),
    );
    if (!user.emailVerified) throw new Error('Verify the workspace account email first.');
    await ensureMembership(db, user);
    const backend = createFreeBackend(db, auth);
    await backend.ensureProfile();
    const server = createAgentBridge(token, createAgentIntake(backend, config));
    server.on('error', () => {
      console.error('Bridge listener failed. Check whether its port is available.');
      void shutdown();
    });
    let stopping = false;
    async function shutdown() {
      if (stopping) return;
      stopping = true;
      server.close();
      await signOut(auth);
      await terminate(db);
      await deleteApp(app);
    }
    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });
    server.listen(port, '127.0.0.1', () =>
      console.log(
        `GroupPoster intake listening on 127.0.0.1:${port}. Facebook publication requires user action.`,
      ),
    );
  } catch (error) {
    await terminate(db);
    await deleteApp(app);
    throw error;
  }
}
void main().catch((error) => {
  // Firebase errors may include account metadata; only report a code or our setup error.
  console.error(
    error?.code ??
      (error?.name === 'ZodError'
        ? 'Invalid bridge configuration.'
        : 'Bridge startup failed. Check the required environment and verified account.'),
  );
  process.exitCode = 1;
});
