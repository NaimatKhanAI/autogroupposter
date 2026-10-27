import { describe, it, expect } from 'vitest';
import { EMPTY_PLAN, validatePlan } from '../src/membershipPlans';
import {
  DAY_MS,
  membershipStatus,
  membershipAllowed,
  membershipExpiry,
  membershipRouteAllowed,
  type MembershipRecord,
} from '../src/membership';
const now = Date.parse('2026-10-22T12:00:00Z');
const member: MembershipRecord = {
  uid: 'user',
  email: 'user@example.com',
  display_name: '',
  trial_started_at: new Date(now).toISOString(),
  approved_free: false,
  subscription_until: null,
  blocked: false,
  updated_at: new Date(now).toISOString(),
  updated_by: 'user',
};
describe('membership boundaries', () => {
  it('ends a trial exactly 14 days after its single start time', () => {
    expect(membershipStatus(member, now + 14 * DAY_MS - 1)).toBe('trial');
    expect(membershipStatus(member, now + 14 * DAY_MS)).toBe('expired');
    expect(membershipExpiry(member, 'trial')).toBe('2026-11-05T12:00:00.000Z');
  });
  it('allows only approved free accounts to bypass an expired trial', () => {
    expect(membershipStatus({ ...member, approved_free: true }, now + 100 * DAY_MS)).toBe('free');
    expect(membershipStatus({ ...member, approved_free: true, blocked: true }, now)).toBe(
      'blocked',
    );
    expect(membershipAllowed('blocked')).toBe(false);
  });
  it('treats paid expiration as exclusive and never infers payment from trial expiry', () => {
    const paid = {
      ...member,
      trial_started_at: new Date(now - 20 * DAY_MS).toISOString(),
      subscription_until: new Date(now + DAY_MS).toISOString(),
    };
    expect(membershipStatus(paid, now)).toBe('subscribed');
    expect(membershipStatus(paid, now + DAY_MS)).toBe('expired');
    expect(membershipStatus(null, now)).toBe('expired');
  });
  it('keeps admin access independent and account management reachable after expiration', () => {
    expect(membershipStatus(null, now, true)).toBe('admin');
    expect(membershipRouteAllowed('(tabs)', 'settings')).toBe(true);
    expect(membershipRouteAllowed('membership')).toBe(true);
    expect(membershipRouteAllowed('post', 'id')).toBe(false);
    expect(membershipRouteAllowed('(tabs)', 'queue')).toBe(false);
  });
});
describe('manual subscription prices', () => {
  it('accepts independently configured currencies without exchange-rate conversion', () => {
    const plan = {
      ...EMPTY_PLAN,
      monthly_prices: { USDT: '12.50', PKR: '3500', SAR: '45', AED: '' },
    };
    expect(validatePlan(plan)).toEqual(plan);
  });
  it('rejects free, negative, malformed prices and invalid contact details', () => {
    for (const value of ['0', '-1', '1e9', '1,000', 'abc'])
      expect(() =>
        validatePlan({
          ...EMPTY_PLAN,
          monthly_prices: { ...EMPTY_PLAN.monthly_prices, USDT: value },
        }),
      ).toThrow();
    expect(() => validatePlan({ ...EMPTY_PLAN, contact_email: 'invalid' })).toThrow();
  });
});
