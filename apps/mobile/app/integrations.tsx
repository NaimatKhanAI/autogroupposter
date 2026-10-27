import { router } from 'expo-router';
import { Screen, Card, Txt, Button, Badge } from '../src/ui';
export default function Integrations() {
  return (
    <Screen title="Automations" subtitle="Keep your workflow simple.">
      <Card>
        <Badge text="MANUAL IMPORTS AVAILABLE" />
        <Txt bold size={20}>
          Your posts, at your pace.
        </Txt>
        <Txt muted>
          Import a published Facebook Page post, choose your groups, and manage your sharing queue.
        </Txt>
        <Button title="Import a post" icon="add-outline" onPress={() => router.push('/import')} />
      </Card>
      <Card>
        <Badge text="N8N SETUP REQUIRED" />
        <Txt bold>Connect your posting workflow</Txt>
        <Txt muted>
          An optional self-hosted n8n bridge can bring published Page posts into this workspace and
          prepare tasks for your selected groups. Your operator needs to configure the bridge before
          automatic imports become available. No Firebase billing upgrade is required.
        </Txt>
        <Txt muted>
          Group sharing is completed by you on Facebook. Importing a post or preparing a task does
          not publish it to a group. Scheduled tasks become ready when you open the app.
        </Txt>
      </Card>
      <Button title="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
