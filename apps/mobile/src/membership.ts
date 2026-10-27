export const TRIAL_DAYS = 14;
export const DAY_MS = 86400000;
export interface MembershipRecord {
  uid: string;
  email: string;
  display_name: string;
  trial_started_at: string;
  approved_free: boolean;
  subscription_until: string | null;
  blocked: boolean;
  updated_at: string;
  updated_by: string;
}
export type MembershipStatus = 'admin' | 'free' | 'trial' | 'subscribed' | 'expired' | 'blocked';
export function membershipStatus(
  record: MembershipRecord | null,
  now: number,
  admin = false,
): MembershipStatus {
  if (admin) return 'admin';
  if (!record || record.blocked) return record?.blocked ? 'blocked' : 'expired';
  if (record.approved_free) return 'free';
  if (record.subscription_until && Date.parse(record.subscription_until) > now) return 'subscribed';
  if (Date.parse(record.trial_started_at) + TRIAL_DAYS * DAY_MS > now) return 'trial';
  return 'expired';
}
export function membershipAllowed(status: MembershipStatus) {
  return ['admin', 'free', 'trial', 'subscribed'].includes(status);
}
export function membershipExpiry(record: MembershipRecord | null, status: MembershipStatus) {
  if (!record) return null;
  if (status === 'subscribed') return record.subscription_until;
  if (status === 'trial')
    return new Date(Date.parse(record.trial_started_at) + TRIAL_DAYS * DAY_MS).toISOString();
  return null;
}
export function membershipRouteAllowed(section?: string, screen?: string) {
  return (
    section === 'membership' ||
    section === 'browser' ||
    section === 'admin' ||
    section === 'auth' ||
    (section === '(tabs)' && screen === 'settings')
  );
}
