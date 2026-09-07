import * as Crypto from 'expo-crypto';

import { dbForUser, type LocalMessage } from './db';
import { getSocket, socketBelongsTo } from './socket';

export function newClientId() {
  return Crypto.randomUUID();
}

interface SendAck {
  message?: { id: string; createdAt: string };
  error?: string;
}

export interface OutgoingAttachment {
  url: string;
  type: 'image' | 'file';
  name?: string;
}

const ACK_TIMEOUT_MS = 8000;

// Emits one message over the socket, keyed by its client-generated id so a
// retry after a dropped ack is recognized server-side instead of duplicated.
// Caller is responsible for the optimistic local insert before calling this.
// Resolves once the local cache reflects the outcome — the connection dying
// before an ack arrives is treated as a failure (flushOutbox will retry it on
// the next reconnect, since 'failed' rows count as pending).
const inFlight = new Map<string, Promise<'sent' | 'failed'>>();
const listeners = new Set<() => void>();
export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function sendMessage(
  userId: string,
  conversationId: string,
  clientId: string,
  body: string,
  attachment?: OutgoingAttachment
) {
  const key = `${userId}:${clientId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = performSend(userId, conversationId, clientId, body, attachment).finally(() => {
    inFlight.delete(key);
    listeners.forEach((listener) => listener());
  });
  inFlight.set(key, request);
  return request;
}

async function performSend(
  userId: string,
  conversationId: string,
  clientId: string,
  body: string,
  attachment?: OutgoingAttachment
): Promise<'sent' | 'failed'> {
  const socket = getSocket();
  const db = dbForUser(userId);
  try {
    if (!socket.connected || !socketBelongsTo(userId)) throw new Error('Offline');
    const res: SendAck = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('message:send', {
      conversationId,
      body,
      clientId,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      attachmentName: attachment?.name,
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
export async function flushOutbox(userId: string, isCurrent: () => boolean) {
  const db = dbForUser(userId);
  const pending = await db.listPendingMessages();
  for (const m of pending) {
    if (!isCurrent() || !getSocket().connected) return;
    if (m.sender_id !== userId) continue;
    await db.setMessageStatus(m.client_id, 'sending');
    if (!isCurrent()) return;
    const attachment: OutgoingAttachment | undefined = m.attachment_url
      ? { url: m.attachment_url, type: (m.attachment_type as 'image' | 'file') ?? 'file', name: m.attachment_name ?? undefined }
      : undefined;
    await sendMessage(userId, m.conversation_id, m.client_id, m.body, attachment);
  }
}

export function localMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachment?: OutgoingAttachment
): LocalMessage {
  return {
    client_id: newClientId(),
    server_id: null,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    created_at: new Date().toISOString(),
    status: 'sending',
    read_at: null,
    reactions: '[]',
    attachment_url: attachment?.url ?? null,
    attachment_type: attachment?.type ?? null,
    attachment_name: attachment?.name ?? null,
  };
}
