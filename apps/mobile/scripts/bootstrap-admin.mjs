// Run only as the Firebase project operator, using the CLI's existing OAuth login.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const email = process.argv[2];
const apply = process.argv.includes('--apply');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Usage: node scripts/bootstrap-admin.mjs EMAIL [--apply]');
const { getGlobalDefaultAccount, getAccessToken } = require('firebase-tools/lib/auth');
const account = getGlobalDefaultAccount();
if (!account) throw new Error('Sign into Firebase CLI as the project operator first.');
const token = await getAccessToken(account.tokens.refresh_token, account.tokens.scopes ?? []);
const project = 'groupposter-1f253';
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok)
    throw new Error(
      `Firebase operator request failed (${response.status}). Check operator permissions.`,
    );
  return response.json();
}
const found = await request(
  `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
  { method: 'POST', body: JSON.stringify({ email: [email] }) },
);
const user = found.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
if (!user)
  throw new Error('This email has no Firebase account. Create and verify it in the app first.');
if (!user.emailVerified)
  throw new Error('This account exists but its email is not verified. Verify it in the app first.');
if (user.disabled) throw new Error('This Firebase account is disabled.');
console.log(`Verified account found: ${user.email}; UID: ${user.localId}`);
if (apply) {
  await request(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/app_admins/${encodeURIComponent(user.localId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields: { enabled: { booleanValue: true } } }),
    },
  );
  console.log('Admin role provisioned. Clients cannot create or modify this role.');
} else console.log('Read-only check complete. Add --apply to provision the admin role.');
