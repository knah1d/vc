import * as SQLite from 'expo-sqlite';

// Local cache + outbox. Chat history renders from here instantly on app open,
// and messages composed offline sit here until they can be flushed to the server.
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface LocalMessage {
  client_id: string;
  server_id: string | null;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  status: MessageStatus;
}

export interface LocalConversation {
  id: string;
  other_id: string;
  other_name: string;
  unread_count: number;
  created_at: string;
}

async function openDb(userId: string) {
  // Never import the legacy shared cache: its account ownership is unknown.
  const database = await SQLite.openDatabaseAsync(`hush-account-${encodeURIComponent(userId)}.db`);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      other_id TEXT NOT NULL,
      other_name TEXT NOT NULL,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      client_id TEXT PRIMARY KEY,
      server_id TEXT,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent'
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  `);
  return database;
}

const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();

export function dbForUser(userId: string) {
  if (!userId) throw new Error('A signed-in account is required for local storage.');
  function getDb() {
    if (!databases.has(userId)) databases.set(userId, openDb(userId));
    return databases.get(userId)!;
  }
  return {
  async upsertConversations(conversations: LocalConversation[]) {
    const database = await getDb();
    for (const c of conversations) {
      await database.runAsync(
        `INSERT INTO conversations (id, other_id, other_name, unread_count, created_at)
         VALUES ($id, $other_id, $other_name, $unread_count, $created_at)
         ON CONFLICT(id) DO UPDATE SET
           other_name = excluded.other_name,
           unread_count = excluded.unread_count`,
        {
          $id: c.id,
          $other_id: c.other_id,
          $other_name: c.other_name,
          $unread_count: c.unread_count,
          $created_at: c.created_at,
        }
      );
    }
  },

  async listConversations(): Promise<LocalConversation[]> {
    const database = await getDb();
    return database.getAllAsync<LocalConversation>(
      `SELECT * FROM conversations ORDER BY created_at DESC`
    );
  },

  async upsertMessages(messages: LocalMessage[]) {
    const database = await getDb();
    for (const m of messages) {
      await database.runAsync(
        `INSERT INTO messages (client_id, server_id, conversation_id, sender_id, body, created_at, status)
         VALUES ($client_id, $server_id, $conversation_id, $sender_id, $body, $created_at, $status)
         ON CONFLICT(client_id) DO UPDATE SET
           server_id = excluded.server_id,
           created_at = excluded.created_at,
           status = excluded.status`,
        {
          $client_id: m.client_id,
          $server_id: m.server_id,
          $conversation_id: m.conversation_id,
          $sender_id: m.sender_id,
          $body: m.body,
          $created_at: m.created_at,
          $status: m.status,
        }
      );
    }
  },

  async setMessageStatus(clientId: string, status: MessageStatus, serverId?: string) {
    const database = await getDb();
    await database.runAsync(
      `UPDATE messages SET status = $status, server_id = COALESCE($server_id, server_id) WHERE client_id = $client_id`,
      { $status: status, $server_id: serverId ?? null, $client_id: clientId }
    );
  },

  async listMessages(conversationId: string): Promise<LocalMessage[]> {
    const database = await getDb();
    return database.getAllAsync<LocalMessage>(
      `SELECT * FROM messages WHERE conversation_id = $conversation_id ORDER BY created_at ASC`,
      { $conversation_id: conversationId }
    );
  },

  async listPendingMessages(): Promise<LocalMessage[]> {
    const database = await getDb();
    return database.getAllAsync<LocalMessage>(
      `SELECT * FROM messages WHERE status IN ('sending', 'failed') ORDER BY created_at ASC`
    );
  },

  // Optimistically zero a conversation's badge the moment it's opened/read,
  // instead of waiting on the next full conversation-list refresh.
  async markConversationRead(conversationId: string) {
    const database = await getDb();
    await database.runAsync(`UPDATE conversations SET unread_count = 0 WHERE id = $id`, { $id: conversationId });
  },
  };
}
