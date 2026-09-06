import * as Crypto from 'expo-crypto';

import { db, type LocalMessage } from './db';
import { getSocket } from './socket';

export function newClientId() {
  return Crypto.randomUUID();
}

interface SendAck {
  message?: { id: string; createdAt: string };
  error?: string;
}

const ACK_TIMEOUT_MS = 8000;

// Emits one message over the socket, keyed by its client-generated id so a
// retry after a dropped ack is recognized server-side instead of duplicated.
// Caller is responsible for the optimistic local insert before calling this.
// Resolves once the local cache reflects the outcome — the connection dying
// before an ack arrives is treated as a failure (flushOutbox will retry it on
// the next reconnect, since 'failed' rows count as pending).
export async function sendMessage(
  conversationId: string,
  clientId: string,
  body: string
): Promise<'sent' | 'failed'> {
  const socket = getSocket();
  try {
    const res: SendAck = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('message:send', {
      conversationId,
      body,
      clientId,
    });
    if (res.message) {
      await db.setMessageStatus(clientId, 'sent', res.message.id);
      return 'sent';
    }
    await db.setMessageStatus(clientId, 'failed');
    return 'failed';
  } catch {
    // Timed out or the socket disconnected mid-request.
    await db.setMessageStatus(clientId, 'failed');
    return 'failed';
  }
}

// Call on reconnect (or app foreground) to resend anything that never got an ack.
export async function flushOutbox() {
  const pending = await db.listPendingMessages();
  for (const m of pending) {
    await db.setMessageStatus(m.client_id, 'sending');
    await sendMessage(m.conversation_id, m.client_id, m.body);
  }
}

export function localMessage(conversationId: string, senderId: string, body: string): LocalMessage {
  return {
    client_id: newClientId(),
    server_id: null,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    created_at: new Date().toISOString(),
    status: 'sending',
  };
}
