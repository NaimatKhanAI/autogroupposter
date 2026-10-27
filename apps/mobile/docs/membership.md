# Trials, subscriptions and admin access

Normal verified accounts get one 14-day trial starting on their first membership initialization in the updated app. The start is a Firestore server timestamp. Signing in again does not restart the trial. Once trial/paid access expires, workspace reads and writes are denied by deployed security rules; account settings, membership status and account deletion remain available. Deletion tombstones prevent recreating a membership for the same UID after deletion starts.

Only administrators can approve ongoing free access, revoke it, activate/extend a paid period, cancel paid access or pause/restore an account. Administrators have workspace access without a subscription. Admins can list membership records but cannot read other users' posts/groups merely because they are administrators.

## Where to find the screens

- **Settings → Trial & subscription** opens `/membership`.
- **Settings → Admin console** opens `/admin` for an authenticated administrator only. Direct links do not bypass the role check.
- Admin console includes monthly prices for **USDT, PKR, SAR and AED**, a contact email and payment instructions. Blank currencies are not offered. Prices are set independently; no exchange-rate conversion occurs.
- Subscription activation defaults to 30 days and accepts 1–366 days. Extending an active subscription adds days to its existing expiry. A calendar-month billing engine, automatic card charges, wallet transfers and recurring renewals are not implemented. The operator verifies payment outside the app and then activates access. Prices do not themselves grant access.

## Admin provisioning

The first administrator is the verified account **imdjaved1995@gmail.com**. Its protected role was provisioned in `app_admins/{uid}` using the Firebase project operator's OAuth login on 2026-10-22. Clients cannot create, edit or delete admin-role records; there is no public role selector or first-user promotion.

For a later administrator, create/verify the intended account, then use the project operator's CLI login:

```powershell
node scripts/bootstrap-admin.mjs administrator@example.com
node scripts/bootstrap-admin.mjs administrator@example.com --apply
```

The first command only checks identity. The second provisions the protected role. Revoke a role through a trusted Firebase project operator by setting its `enabled` field to `false`. Never ship operator OAuth tokens or Admin SDK credentials in the app.

## Storage and enforcement

- `memberships/{uid}`: server-timed trial start, approved-free flag, paid expiry, paused flag and last updater/time. The member can create only the initial unprivileged record. Admin updates cannot change trial history, email or UID.
- `membership_config/default`: monthly prices and payment instructions; readable by verified accounts and writable only by admins.
- `app_admins/{uid}`: operator-provisioned role, readable only by the corresponding verified account.

The app refreshes membership on snapshots and checks expiry every 15 seconds and on foreground return. Firestore uses `request.time` to enforce actual expiry, independently of the phone's clock. Existing n8n bridge calls remain subject to those same rules and initialize a trial record before serving requests.

Admin lists show the 100 most recently registered membership records and support filtering those displayed records. Larger deployments need paginated/searchable administration. Trials are per Firebase account; this does not implement identity/payment-method fraud detection across different UIDs.

## Verification — 2026-10-22

- TypeScript, ESLint and 77 unit tests passed.
- All 19 Firestore emulator tests passed, including direct SDK attempts to self-approve, forge paid access, reset a trial, edit prices, read another member's grant and promote an admin role.
- Client membership creation and admin activation/cancellation were tested against the emulator under the real rules.
- Tested Firestore rules were deployed to `groupposter-1f253`; no Blaze upgrade or Cloud Functions deployment was used.
- Android release preview built and installed on the connected vivo phone. The verified administrator opened the live Admin console and loaded the member list/pricing form. No real subscription was activated and no prices were invented during verification.
- Local evidence is in ignored `artifacts/device-admin.png` and `artifacts/device-admin-pricing.png`; deployment/build/emulator logs are in ignored `.tools/membership-*.log` files.

Existing clients must install the updated APK so they can initialize membership and display expiration/admin screens. The preview remains debug-signed, not a Play production release.
