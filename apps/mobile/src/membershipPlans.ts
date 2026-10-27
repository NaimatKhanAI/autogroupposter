export const CURRENCIES = ['USDT', 'PKR', 'SAR', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];
export interface MembershipPlan {
  monthly_prices: Record<Currency, string>;
  contact_email: string;
  payment_instructions: string;
}
export const EMPTY_PLAN: MembershipPlan = {
  monthly_prices: { USDT: '', PKR: '', SAR: '', AED: '' },
  contact_email: '',
  payment_instructions: '',
};
export function validatePlan(plan: MembershipPlan) {
  for (const currency of CURRENCIES) {
    const value = plan.monthly_prices[currency];
    if (value && (!/^\d{1,9}(\.\d{1,6})?$/.test(value) || Number(value) <= 0))
      throw new Error(`Enter a positive monthly price for ${currency}, or leave it blank.`);
  }
  if (plan.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plan.contact_email))
    throw new Error('Enter a valid contact email.');
  if (plan.contact_email.length > 320 || plan.payment_instructions.length > 2000)
    throw new Error('Payment instructions are too long.');
  return plan;
}
