export function authRedirect(
  signedIn: boolean,
  section: string | undefined,
  screen: string | undefined,
): '/auth' | '/(tabs)' | null {
  if (!signedIn && section !== 'auth') return '/auth';
  if (signedIn && section === 'auth' && screen !== 'callback') return '/(tabs)';
  return null;
}
