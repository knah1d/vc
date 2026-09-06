import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";

interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface ChatWindowProps {
  conversationId: string;
  onStartCall: () => void;
}

export default function ChatWindow({ conversationId, onStartCall }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.listMessages(conversationId).then(({ messages }) => {
      if (!cancelled) setMessages(messages);
    });

    const socket = getSocket();
    function handleNew({ message }: { message: Message & { conversationId: string } }) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    }
    socket.on("message:new", handleNew);
    return () => {
      cancelled = true;
      socket.off("message:new", handleNew);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const socket = getSocket();
    socket.emit(
      "message:send",
      { conversationId, body: draft },
      (res: { message?: Message; error?: string }) => {
        if (res.message) setMessages((prev) => [...prev, res.message!]);
      }
    );
    setDraft("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>
        <button onClick={onStartCall}>📞 Start video call</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              textAlign: m.senderId === user?.id ? "right" : "left",
              margin: "0.25rem 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "0.4rem 0.7rem",
                borderRadius: 12,
                background: m.senderId === user?.id ? "#3b82f6" : "#e5e7eb",
                color: m.senderId === user?.id ? "#fff" : "#111",
              }}
            >
              {m.body}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", padding: "0.5rem", gap: "0.5rem" }}>
        <input
          style={{ flex: 1 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
