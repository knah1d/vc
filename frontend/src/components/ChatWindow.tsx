import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import type { CallMode } from "../lib/calls";
import Icon, { Avatar } from "./Icon";

interface Message { id: string; senderId: string; body: string; createdAt: string }
interface ChatWindowProps {
  conversationId: string;
  otherName: string;
  connected: boolean;
  callDisabled: boolean;
  onStartCall: (mode: CallMode) => void;
  onRead: () => void;
  onBack: () => void;
}
function mergeMessages(previous: Message[], incoming: Message[]) {
  return [...new Map([...previous, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function ChatWindow({ conversationId, otherName, connected, callDisabled, onStartCall, onRead, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasTyping = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let otherTypingTimer: ReturnType<typeof setTimeout> | undefined;
    const socket = getSocket();
    async function markRead() {
      try { await api.markRead(conversationId); if (!cancelled) onReadRef.current(); }
      catch { /* A reconnect will retry the read receipt. */ }
    }
    async function load() {
      try {
        const result = await api.listMessages(conversationId);
        if (!cancelled) { setMessages((prev) => mergeMessages(prev, result.messages)); setError(null); }
        await markRead();
      } catch (err) { if (!cancelled) setError((err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    function handleNew({ message }: { message: Message & { conversationId: string } }) {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => mergeMessages(prev, [message]));
      setOtherTyping(false);
      void markRead();
    }
    function handleTyping({ conversationId: cid, isTyping }: { conversationId: string; isTyping: boolean }) {
      if (cid !== conversationId) return;
      setOtherTyping(isTyping);
      clearTimeout(otherTypingTimer);
      if (isTyping) otherTypingTimer = setTimeout(() => setOtherTyping(false), 3000);
    }
    socket.on("message:new", handleNew);
    socket.on("typing", handleTyping);
    socket.on("connect", load);
    return () => {
      cancelled = true;
      clearTimeout(typingStopTimer.current);
      clearTimeout(otherTypingTimer);
      if (wasTyping.current) socket.volatile.emit("typing", { conversationId, isTyping: false });
      socket.off("message:new", handleNew);
      socket.off("typing", handleTyping);
      socket.off("connect", load);
    };
  }, [conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, otherTyping]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = getSocket();
    // Refresh the signal as the person types, so a lost stop event can't stick.
    socket.volatile.emit("typing", { conversationId, isTyping: Boolean(value.trim()) });
    wasTyping.current = Boolean(value.trim());
    clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      wasTyping.current = false;
      socket.volatile.emit("typing", { conversationId, isTyping: false });
    }, 2000);
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending || !connected) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    clearTimeout(typingStopTimer.current);
    wasTyping.current = false;
    getSocket().volatile.emit("typing", { conversationId, isTyping: false });
    getSocket().timeout(10_000).volatile.emit("message:send", { conversationId, body }, (timeout: Error | null, res?: { message?: Message; error?: string }) => {
      setSending(false);
      if (timeout) setError("No delivery confirmation. Check the conversation before sending again.");
      else if (res?.error) setError(res.error);
      else if (res?.message) {
        setMessages((prev) => mergeMessages(prev, [res.message!]));
        setDraft((current) => current.trim() === body ? "" : current);
        inputRef.current?.focus();
      }
    });
  }

  return <section className="chat-window">
    <header className="chat-header"><button className="icon-button mobile-back" onClick={onBack} aria-label="Back to conversations"><Icon name="arrow" /></button><Avatar name={otherName} /><div className="chat-person"><h2>{otherName}</h2><span>{otherTyping ? "Typing a little something…" : "A space for the two of you"}</span></div><div className="chat-actions"><button className="icon-button" onClick={() => onStartCall("voice")} disabled={callDisabled} aria-label="Start voice call" title="Voice call"><Icon name="phone" /></button><button className="icon-button video-button" onClick={() => onStartCall("video")} disabled={callDisabled} aria-label="Start video call" title="Video call"><Icon name="video" /></button></div></header>
    <div className="message-scroll" role="log" aria-label={`Messages with ${otherName}`} aria-live="polite">
      <div className="conversation-intro"><Avatar name={otherName} large /><h3>{otherName}</h3><p>{loading ? "Loading your conversation…" : "Every good conversation starts with a hello."}</p></div>
      {messages.map((message, i) => {
        const mine = message.senderId === user?.id;
        const date = new Date(message.createdAt);
        const previous = messages[i - 1];
        const newDay = !previous || new Date(previous.createdAt).toDateString() !== date.toDateString();
        return <div key={message.id}>{newDay && <div className="date-divider"><span>{date.toDateString() === new Date().toDateString() ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div>}<div className={`message-row ${mine ? "mine" : "theirs"}`}>{!mine && <Avatar name={otherName} />}<div className="message-content"><div className="message-bubble">{message.body}</div><time dateTime={message.createdAt}>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div></div></div>;
      })}
      {otherTyping && <div className="typing-indicator" aria-label={`${otherName} is typing`}><i /><i /><i /></div>}
      <div ref={bottomRef} />
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="composer-area"><form className="composer" onSubmit={sendMessage}><input ref={inputRef} aria-label="Message" maxLength={10000} value={draft} onChange={(e) => handleDraftChange(e.target.value)} placeholder={connected ? `Message ${otherName.split(" ")[0]}…` : "Waiting for connection…"} /><button className="send-button" type="submit" disabled={!draft.trim() || sending || !connected} aria-label={sending ? "Sending message" : "Send message"}><Icon name="send" size={20} /></button></form><p className="composer-hint">{sending ? "Sending your message…" : "A little message can make someone’s day."}<span>Enter to send</span></p></div>
  </section>;
}
