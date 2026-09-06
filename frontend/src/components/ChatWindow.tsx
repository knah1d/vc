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
  onRead: () => void;
}

const TYPING_STOP_DELAY_MS = 2000;

export default function ChatWindow({ conversationId, onStartCall, onRead }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasTypingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.listMessages(conversationId).then(({ messages }) => {
      if (!cancelled) setMessages(messages);
    });
    api.markRead(conversationId).then(onRead);
    setOtherTyping(false);

    const socket = getSocket();
    function handleNew({ message }: { message: Message & { conversationId: string } }) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
        api.markRead(conversationId).then(onRead);
      }
    }
    function handleTyping({ conversationId: cid, isTyping }: { conversationId: string; isTyping: boolean }) {
      if (cid === conversationId) setOtherTyping(isTyping);
    }
    socket.on("message:new", handleNew);
    socket.on("typing", handleTyping);
    return () => {
      cancelled = true;
      socket.off("message:new", handleNew);
      socket.off("typing", handleTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = getSocket();
    if (!wasTypingRef.current) {
      wasTypingRef.current = true;
      socket.emit("typing", { conversationId, isTyping: true });
    }
    clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      wasTypingRef.current = false;
      socket.emit("typing", { conversationId, isTyping: false });
    }, TYPING_STOP_DELAY_MS);
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const socket = getSocket();
    clearTimeout(typingStopTimer.current);
    if (wasTypingRef.current) {
      wasTypingRef.current = false;
      socket.emit("typing", { conversationId, isTyping: false });
    }
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
      <div style={{ height: "1.25rem", padding: "0 1rem", color: "#666", fontSize: "0.85rem" }}>
        {otherTyping && "typing…"}
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", padding: "0.5rem", gap: "0.5rem" }}>
        <input
          style={{ flex: 1 }}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Type a message"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
