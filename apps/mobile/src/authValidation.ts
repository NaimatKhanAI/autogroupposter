import { z } from 'zod';
export type AuthMode = 'login' | 'register' | 'reset';
export function authFormSchema(mode: AuthMode) {
  return z
    .object({
      email: z.string().trim().pipe(z.email('Enter a valid email address.')),
      password: z.string(),
      displayName: z.string().trim().max(120, 'Keep your name under 120 characters.'),
      confirmPassword: z.string(),
    })
    .superRefine((v, ctx) => {
      if (mode === 'register') {
        if (v.displayName.length < 2)
          ctx.addIssue({
            code: 'custom',
            path: ['displayName'],
            message: 'Enter your name (at least 2 characters).',
          });
        if (v.password.length < 8)
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message: 'Use at least 8 characters.',
          });
        if (v.confirmPassword !== v.password)
          ctx.addIssue({
            code: 'custom',
            path: ['confirmPassword'],
            message: 'Passwords do not match.',
          });
      } else if (mode === 'login' && !v.password)
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Enter your password.' });
    });
}
