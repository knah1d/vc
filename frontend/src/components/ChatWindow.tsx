import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";
import type { CallMode } from "../lib/calls";
import Icon, { Avatar } from "./Icon";
import { IconButton, Notice } from "./ui";

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
    getSocket().timeout(10_000).emit("message:send", { conversationId, body }, (timeout: Error | null, res?: { message?: Message; error?: string }) => {
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

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-20 shrink-0 items-center gap-3 border-b border-white/75 bg-white/15 px-4 lg:h-23 lg:px-8">
        <button className="-ml-1 p-1 text-lavender-700 md:hidden" onClick={onBack} aria-label="Back to conversations"><Icon name="arrow" /></button>
        <Avatar name={otherName} />
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{otherName}</h2><span className="mt-1 block truncate text-[10px] text-muted sm:text-xs">{otherTyping ? "Typing a little something…" : "A space for the two of you"}</span></div>
        <div className="flex gap-2">
          <IconButton label="Start voice call" onClick={() => onStartCall("voice")} disabled={callDisabled}><Icon name="phone" /></IconButton>
          <IconButton label="Start video call" onClick={() => onStartCall("video")} disabled={callDisabled} className="bg-lavender-100/70"><Icon name="video" /></IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-3 md:px-8" role="log" aria-label={`Messages with ${otherName}`} aria-live="polite">
        <div className="pt-3 pb-8 text-center">
          <Avatar name={otherName} large /><h3 className="mt-4 mb-1.5 text-sm font-semibold">{otherName}</h3>
          <p className="text-xs text-muted">{loading ? "Loading your conversation…" : "Every good conversation starts with a hello."}</p>
        </div>
        {messages.map((message, i) => {
          const mine = message.senderId === user?.id;
          const date = new Date(message.createdAt);
          const previous = messages[i - 1];
          const newDay = !previous || new Date(previous.createdAt).toDateString() !== date.toDateString();
          return <div key={message.id}>
            {newDay && <div className="my-5 flex items-center justify-center gap-4 text-[10px] text-muted before:h-px before:w-14 before:bg-lavender-200/50 after:h-px after:w-14 after:bg-lavender-200/50"><span>{date.toDateString() === new Date().toDateString() ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div>}
            <div className={`mb-5 flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
              {!mine && <span className="mb-5"><Avatar name={otherName} small /></span>}
              <div className="min-w-0 max-w-[82%] md:max-w-[75%]">
                <div className={`rounded-2xl border px-4 py-3 text-sm leading-7 whitespace-pre-wrap wrap-anywhere ${mine ? "rounded-br-sm border-lavender-300/60 bg-linear-to-br from-lavender-500 to-lavender-600 text-white shadow-button" : "rounded-bl-sm border-white/90 bg-white/80 text-ink shadow-sm shadow-lavender-700/5"}`}>{message.body}</div>
                <time className={`mt-1.5 block text-[10px] text-muted ${mine ? "text-right" : ""}`} dateTime={message.createdAt}>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
            </div>
          </div>;
        })}
        {otherTyping && <div className="mb-3 flex w-fit gap-1 rounded-2xl bg-white/70 px-4 py-3" aria-label={`${otherName} is typing`}>{[0, 1, 2].map((i) => <i key={i} className="size-1.5 animate-typing rounded-full bg-lavender-400" style={{ animationDelay: `${i * .15}s` }} />)}</div>}
        <div ref={bottomRef} />
      </div>

      {error && <Notice tone="error" className="mx-4 my-2">{error}</Notice>}
      <div className="shrink-0 px-3 pt-3 pb-4 md:px-7 md:pb-5">
        <form className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 py-2 pr-2 pl-4 shadow-sm shadow-lavender-700/5 focus-within:border-lavender-300" onSubmit={sendMessage}>
          <input ref={inputRef} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-faint" aria-label="Message" maxLength={10000} value={draft} onChange={(e) => handleDraftChange(e.target.value)} placeholder={connected ? `Message ${otherName.split(" ")[0]}…` : "Waiting for connection…"} />
          <button className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/30 bg-linear-to-br from-lavender-500 to-lavender-600 text-white shadow-button" type="submit" disabled={!draft.trim() || sending || !connected} aria-label={sending ? "Sending message" : "Send message"}><Icon name="send" size={20} /></button>
        </form>
        <p className="mx-1 mt-2.5 flex justify-between text-[10px] text-muted">{sending ? "Sending your message…" : "A little message can make someone’s day."}<span className="hidden sm:inline">Enter to send</span></p>
      </div>
    </section>
  );
}
