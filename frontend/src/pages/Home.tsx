import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import ChatWindow from "../components/ChatWindow";
import CallModal from "../components/CallModal";

interface Conversation {
  id: string;
  other: { id: string; displayName: string };
  unreadCount: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [otherEmail, setOtherEmail] = useState("");
  const [incomingCall, setIncomingCall] = useState<{ conversationId: string; callerId: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ token: string; url: string } | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  function refreshConversations() {
    api.listConversations().then(({ conversations }) => setConversations(conversations));
  }

  function markConversationRead(conversationId: string) {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
  }

  useEffect(() => {
    refreshConversations();

    const socket = getSocket();
    function onIncoming(payload: { conversationId: string; callerId: string }) {
      setIncomingCall(payload);
    }
    function onAccepted({ conversationId }: { conversationId: string }) {
      api.getVideoToken(conversationId).then(({ token, url }) => setActiveCall({ token, url }));
    }
    function onDeclinedOrEnded() {
      setActiveCall(null);
      setIncomingCall(null);
    }
    // Bumps the sidebar badge for conversations the user isn't currently viewing;
    // ChatWindow handles marking messages read (and resetting the badge) for the active one.
    function onMessageNew({ message }: { message: { conversationId: string } }) {
      if (message.conversationId === activeIdRef.current) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === message.conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c))
      );
    }
    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:declined", onDeclinedOrEnded);
    socket.on("call:ended", onDeclinedOrEnded);
    socket.on("message:new", onMessageNew);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:declined", onDeclinedOrEnded);
      socket.off("call:ended", onDeclinedOrEnded);
      socket.off("message:new", onMessageNew);
    };
  }, []);

  async function handleStartConversation(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { conversation } = await api.startConversation(otherEmail);
      setOtherEmail("");
      refreshConversations();
      setActiveId(conversation.id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function handleStartCall() {
    const conversation = conversations.find((c) => c.id === activeId);
    if (!conversation) return;
    getSocket().emit("call:invite", { conversationId: conversation.id, calleeId: conversation.other.id });
  }

  async function acceptCall() {
    if (!incomingCall) return;
    const { conversationId, callerId } = incomingCall;
    getSocket().emit("call:accept", { conversationId, callerId });
    const { token, url } = await api.getVideoToken(conversationId);
    setActiveCall({ token, url });
    setIncomingCall(null);
  }

  function declineCall() {
    if (!incomingCall) return;
    getSocket().emit("call:decline", incomingCall);
    setIncomingCall(null);
  }

  function leaveCall() {
    const conversation = conversations.find((c) => c.id === activeId);
    if (conversation) {
      getSocket().emit("call:hangup", { conversationId: conversation.id, otherUserId: conversation.other.id });
    }
    setActiveCall(null);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 260, borderRight: "1px solid #ddd", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>{user?.displayName}</strong>
          <button onClick={logout}>Log out</button>
        </div>
        <form onSubmit={handleStartConversation} style={{ margin: "1rem 0" }}>
          <input
            placeholder="Start chat by email"
            value={otherEmail}
            onChange={(e) => setOtherEmail(e.target.value)}
            style={{ width: "100%" }}
          />
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  fontWeight: c.id === activeId ? "bold" : "normal",
                }}
              >
                <span>{c.other.displayName}</span>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      borderRadius: 999,
                      padding: "0 0.45rem",
                      fontSize: "0.75rem",
                      minWidth: "1.2rem",
                      textAlign: "center",
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main style={{ flex: 1 }}>
        {activeId ? (
          <ChatWindow
            conversationId={activeId}
            onStartCall={handleStartCall}
            onRead={() => markConversationRead(activeId)}
          />
        ) : (
          <p style={{ padding: "1rem" }}>Select or start a conversation.</p>
        )}
      </main>

      {incomingCall && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "#fff", border: "1px solid #ddd", padding: "1rem" }}>
          <p>Incoming call…</p>
          <button onClick={acceptCall}>Accept</button>
          <button onClick={declineCall}>Decline</button>
        </div>
      )}

      {activeCall && <CallModal token={activeCall.token} serverUrl={activeCall.url} onLeave={leaveCall} />}
    </div>
  );
}
