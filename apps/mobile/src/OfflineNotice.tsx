import React, { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Card, Txt } from './ui';
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOffline(s.isConnected === false || s.isInternetReachable === false),
      ),
    [],
  );
  return offline ? (
    <Card>
      <Txt bold>You are offline</Txt>
      <Txt muted>
        Reconnect to load current data or update tasks. Sharing actions require a connection.
      </Txt>
    </Card>
  ) : null;
}
