import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import ChatWindow from "../components/ChatWindow";
import CallModal from "../components/CallModal";

interface Conversation {
  id: string;
  other: { id: string; displayName: string };
}

export default function Home() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [otherEmail, setOtherEmail] = useState("");
  const [incomingCall, setIncomingCall] = useState<{ conversationId: string; callerId: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ token: string; url: string } | null>(null);

  function refreshConversations() {
    api.listConversations().then(({ conversations }) => setConversations(conversations));
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
    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:declined", onDeclinedOrEnded);
    socket.on("call:ended", onDeclinedOrEnded);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:declined", onDeclinedOrEnded);
      socket.off("call:ended", onDeclinedOrEnded);
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
                style={{ width: "100%", textAlign: "left", fontWeight: c.id === activeId ? "bold" : "normal" }}
              >
                {c.other.displayName}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main style={{ flex: 1 }}>
        {activeId ? (
          <ChatWindow conversationId={activeId} onStartCall={handleStartCall} />
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
