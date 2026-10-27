import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './config/firebase';
import { ensureMembership } from './membershipApi';
import { normalize } from './firebaseOperations';
import { membershipAllowed, membershipStatus, type MembershipRecord } from './membership';

export function useMembershipState(uid?: string) {
  const [state, setState] = useState<{
    uid?: string;
    key?: string;
    record: MembershipRecord | null;
    admin: boolean;
    recordReady: boolean;
    roleReady: boolean;
    error: Error | null;
  }>({ record: null, admin: false, recordReady: false, roleReady: false, error: null });
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  const key = `${uid ?? ''}:${retry}`;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 15000);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      app.remove();
    };
  }, []);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const update = (change: Partial<typeof state>) =>
      setState((previous) => ({
        ...(previous.key === key
          ? previous
          : {
              uid,
              key,
              record: null,
              admin: false,
              recordReady: false,
              roleReady: false,
              error: null,
            }),
        ...change,
      }));
    const fail = (error: Error) => {
      if (active) update({ error });
    };
    const role = onSnapshot(
      doc(db, 'app_admins', uid),
      (snapshot) => {
        if (active) update({ admin: snapshot.data()?.enabled === true, roleReady: true });
      },
      fail,
    );
    const user = auth.currentUser;
    if (user?.uid === uid)
      void ensureMembership(db, user)
        .then(() => {
          if (!active) return;
          unsubscribe = onSnapshot(
            doc(db, 'memberships', uid),
            (snapshot) => {
              if (active)
                update({
                  record: snapshot.exists() ? normalize(snapshot.data()) : null,
                  recordReady: true,
                });
            },
            fail,
          );
        })
        .catch(fail);
    return () => {
      active = false;
      role();
      unsubscribe?.();
    };
  }, [uid, key]);
  const current = state.key === key;
  const ready = Boolean(uid && current && state.recordReady && state.roleReady && now);
  const status = membershipStatus(current ? state.record : null, now, current && state.admin);
  return {
    ready,
    status,
    allowed: ready && membershipAllowed(status),
    isAdmin: ready && state.admin,
    record: current ? state.record : null,
    now,
    error: current ? state.error : null,
    retry: () => setRetry((n) => n + 1),
  };
}
type MembershipState = ReturnType<typeof useMembershipState>;
export const MembershipContext = createContext<MembershipState | null>(null);
export function useMembership() {
  const value = useContext(MembershipContext);
  if (!value) throw new Error('Membership context is missing.');
  return value;
}
