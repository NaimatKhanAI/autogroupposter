import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { normalize } from './firebaseOperations';
import { DAY_MS, type MembershipRecord } from './membership';
import { EMPTY_PLAN, type MembershipPlan } from './membershipPlans';

export async function readMembershipPlan(db: Firestore): Promise<MembershipPlan> {
  const snapshot = await getDoc(doc(db, 'membership_config', 'default'));
  return snapshot.exists() ? (snapshot.data() as MembershipPlan) : EMPTY_PLAN;
}

export async function ensureMembership(
  db: Firestore,
  user: Pick<User, 'uid' | 'email' | 'displayName' | 'emailVerified'>,
) {
  if (!user.emailVerified || !user.email)
    throw new Error('Verify your email before starting your trial.');
  const reference = doc(db, 'memberships', user.uid);
  await runTransaction(db, async (tx) => {
    if ((await tx.get(reference)).exists()) return;
    tx.set(reference, {
      uid: user.uid,
      email: user.email,
      display_name: user.displayName ?? '',
      trial_started_at: serverTimestamp(),
      approved_free: false,
      subscription_until: null,
      blocked: false,
      updated_at: serverTimestamp(),
      updated_by: user.uid,
    });
  });
}
export async function readMembership(db: Firestore, uid: string): Promise<MembershipRecord | null> {
  const record = await getDoc(doc(db, 'memberships', uid));
  return record.exists() ? normalize(record.data()) : null;
}
export type AdminMembershipAction =
  'approve_free' | 'revoke_free' | 'subscribe' | 'cancel_subscription' | 'block' | 'unblock';
export async function updateMembership(
  db: Firestore,
  actorUid: string,
  targetUid: string,
  action: AdminMembershipAction,
  days = 30,
) {
  if (!targetUid || !actorUid) throw new Error('Select an account.');
  if (action === 'subscribe' && (!Number.isInteger(days) || days < 1 || days > 366))
    throw new Error('Subscription duration must be between 1 and 366 days.');
  const reference = doc(db, 'memberships', targetUid);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(reference);
    if (!snapshot.exists()) throw new Error('The member record no longer exists.');
    const change: Record<string, unknown> = { updated_at: serverTimestamp(), updated_by: actorUid };
    switch (action) {
      case 'approve_free':
        change.approved_free = true;
        change.blocked = false;
        break;
      case 'revoke_free':
        change.approved_free = false;
        break;
      case 'subscribe': {
        const previous = snapshot.data().subscription_until;
        const start = Math.max(Date.now(), previous instanceof Timestamp ? previous.toMillis() : 0);
        change.subscription_until = Timestamp.fromMillis(start + days * DAY_MS);
        change.blocked = false;
        break;
      }
      case 'cancel_subscription':
        change.subscription_until = null;
        break;
      case 'block':
        change.blocked = true;
        break;
      case 'unblock':
        change.blocked = false;
        break;
      default:
        throw new Error('Unknown membership action.');
    }
    tx.update(reference, change);
  });
}
