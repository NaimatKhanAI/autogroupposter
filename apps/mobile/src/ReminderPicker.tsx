import React, { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Card, Txt, Row } from './ui';
export function ReminderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(() => new Date(Date.now() + 3600000));
  return (
    <Card>
      <Txt bold>Schedule a reminder</Txt>
      <Txt muted>
        {value ? new Date(value).toLocaleString() : 'Ready immediately, without a reminder'}
      </Txt>
      <Txt muted size={12}>
        Device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Saved in UTC.
      </Txt>
      <Row>
        <Button title="Choose date & time" secondary onPress={() => setMode('date')} />
        {value && <Button title="Clear reminder" secondary onPress={() => onChange('')} />}
      </Row>
      {mode && (
        <DateTimePicker
          value={draft}
          mode={mode}
          minimumDate={new Date()}
          onChange={(event, date) => {
            if (event.type === 'dismissed' || !date) {
              setMode(null);
              return;
            }
            setDraft(date);
            if (mode === 'date') setMode('time');
            else {
              onChange(date.toISOString());
              setMode(null);
            }
          }}
        />
      )}
    </Card>
  );
}
