import { useEffect, useRef, useState } from 'react';

import { api } from './api';
import { callError, checkMedia, type CallInvite, type CallMode } from './calls';
import { getSocket } from './socket';

interface CallState extends CallInvite {
  phase: 'incoming' | 'outgoing' | 'connecting' | 'active';
  token?: string;
  url?: string;
}

function signal<T>(event: string, payload: unknown): Promise<T> {
  const socket = getSocket();
  if (!socket.connected) return Promise.reject(new Error("You're disconnected. Wait for the connection to return."));
  return new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (error: Error | null, response: T & { error?: string }) => {
      if (error) reject(new Error('The call request timed out. Please try again.'));
      else if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
  });
}

// Ported from the web app's lib/useCalls.ts — same backend contract (call:invite/
// accept/decline/hangup over the socket, LiveKit token fetched once accepted), so
// the state machine is identical; only checkMedia/callError are platform-specific.
export function useCalls() {
  const [call, setCall] = useState<CallState | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const callRef = useRef<CallState | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);

  function update(next: CallState | null) {
    callRef.current = next;
    setCall(next);
  }
  function close(reason?: string, notify = true) {
    const current = callRef.current;
    revision.current++;
    update(null);
    busy.current = false;
    setPreparing(false);
    if (reason) setNotice(reason);
    if (current && notify) void signal('call:hangup', { callId: current.callId }).catch(() => {});
  }

  useEffect(() => {
    const socket = getSocket();
    function incoming(invite: CallInvite) {
      if (callRef.current || busy.current) {
        void signal('call:decline', { callId: invite.callId }).catch(() => {});
        return;
      }
      setNotice(null);
      update({ ...invite, phase: 'incoming' });
    }
    async function accepted(invite: CallInvite) {
      if (callRef.current?.callId !== invite.callId || callRef.current.phase !== 'outgoing') return;
      update({ ...invite, phase: 'connecting' });
      try {
        const credentials = await api.getVideoToken(invite.conversationId, invite.callId);
        if (callRef.current?.callId === invite.callId) update({ ...invite, phase: 'active', ...credentials });
      } catch (error) {
        if (callRef.current?.callId === invite.callId) close(callError(error));
      }
    }
    function ended({ callId, reason }: { callId: string; reason: string }) {
      if (callRef.current?.callId === callId) close(reason, false);
    }
    function answered({ callId, socketId }: { callId: string; socketId: string }) {
      if (callRef.current?.callId === callId && socketId !== socket.id) close('Call answered on another device.', false);
    }
    function disconnected() {
      if (callRef.current || busy.current) close('Connection lost. Please try calling again once reconnected.', false);
    }
    socket.on('call:incoming', incoming);
    socket.on('call:accepted', accepted);
    socket.on('call:ended', ended);
    socket.on('call:answered', answered);
    socket.on('disconnect', disconnected);
    return () => {
      socket.off('call:incoming', incoming);
      socket.off('call:accepted', accepted);
      socket.off('call:ended', ended);
      socket.off('call:answered', answered);
      socket.off('disconnect', disconnected);
      revision.current++;
      if (callRef.current) void signal('call:hangup', { callId: callRef.current.callId }).catch(() => {});
    };
  }, []);

  async function start(conversationId: string, mode: CallMode) {
    if (busy.current || callRef.current) return;
    busy.current = true;
    setPreparing(true);
    setNotice(null);
    const attempt = ++revision.current;
    try {
      const { configured } = await api.callStatus();
      if (!configured) throw new Error("Calling isn't set up yet. Ask the server owner to configure LiveKit for voice and video calls.");
      if (attempt !== revision.current) return;
      await checkMedia(mode);
      if (attempt !== revision.current) return;
      const { call: invite } = await signal<{ call: CallInvite }>('call:invite', { conversationId, mode });
      if (attempt !== revision.current) {
        void signal('call:hangup', { callId: invite.callId }).catch(() => {});
        return;
      }
      update({ ...invite, phase: 'outgoing' });
    } catch (error) {
      if (attempt === revision.current) setNotice(callError(error));
    } finally {
      if (attempt === revision.current) {
        busy.current = false;
        setPreparing(false);
      }
    }
  }

  async function accept() {
    const current = callRef.current;
    if (!current || current.phase !== 'incoming' || busy.current) return;
    const attempt = revision.current;
    busy.current = true;
    update({ ...current, phase: 'connecting' });
    try {
      await checkMedia(current.mode);
      if (callRef.current?.callId !== current.callId) return;
      const credentials = await api.getVideoToken(current.conversationId, current.callId);
      if (callRef.current?.callId !== current.callId) return;
      await signal('call:accept', { callId: current.callId });
      if (callRef.current?.callId === current.callId) update({ ...current, phase: 'active', ...credentials });
    } catch (error) {
      if (callRef.current?.callId === current.callId) close(callError(error));
    } finally {
      if (revision.current === attempt) busy.current = false;
    }
  }

  function decline() {
    const current = callRef.current;
    if (current) void signal('call:decline', { callId: current.callId }).catch(() => {});
    close(undefined, false);
  }

  return { call, preparing, notice, dismissNotice: () => setNotice(null), start, accept, decline, close };
}
