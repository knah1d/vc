import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "../lib/api";
import { getSocket, isSocketConnected, subscribeConnection } from "../lib/socket";
import { useCalls } from "../lib/useCalls";
import { useAuth } from "../context/AuthContext";
import ChatWindow from "../components/ChatWindow";
import CallDialog from "../components/CallDialog";
import { Brand, Button, Eyebrow, GlassPanel, IconButton, Input, Notice, StatusDot } from "../components/ui";

const CallModal = lazy(() => import("../components/CallModal"));
import Icon, { Avatar } from "../components/Icon";

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
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connected = useSyncExternalStore(subscribeConnection, isSocketConnected);
  const emailRef = useRef<HTMLInputElement>(null);
  const calls = useCalls();

  const refreshConversations = useCallback(async () => {
    try {
      const result = await api.listConversations();
      setConversations(result.conversations);
      setError(null);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  function markConversationRead(conversationId: string) {
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshConversations(), 0);
    const socket = getSocket();
    function onConnect() { void refreshConversations(); }
    function onMessageNew() { void refreshConversations(); }
    socket.on("connect", onConnect);
    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onMessageNew);
    return () => {
      clearTimeout(initial);
      socket.off("connect", onConnect);
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onMessageNew);
    };
  }, [refreshConversations]);

  useEffect(() => { if (showNew) emailRef.current?.focus(); }, [showNew]);

  async function handleStartConversation(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const { conversation } = await api.startConversation(otherEmail.trim());
      await refreshConversations();
      setOtherEmail("");
      setShowNew(false);
      setActiveId(conversation.id);
    } catch (err) { setError((err as Error).message); }
    finally { setStarting(false); }
  }

  const active = conversations.find((c) => c.id === activeId);
  const callPerson = conversations.find((c) => c.id === calls.call?.conversationId)?.other.displayName || "Your contact";
  const visible = conversations.filter((c) => c.other.displayName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto flex h-dvh max-w-[1512px] flex-col px-3 md:px-6 xl:px-12">
      <header className="flex h-18 shrink-0 items-center gap-7 md:h-24">
        <Brand />
        <span className="hidden border-l border-lavender-300/30 pl-7 text-xs text-muted md:inline">A little space for your people.</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted"><StatusDot online={connected} />{connected ? "Connected" : "Reconnecting…"}</span>
      </header>

      {calls.notice && <Notice className="mb-3"><Icon name="phone" size={18} /><span className="flex-1">{calls.notice}</span><IconButton label="Dismiss notification" onClick={calls.dismissNotice}><Icon name="close" size={16} /></IconButton></Notice>}
      {calls.preparing && <Notice className="mb-3"><span className="flex-1">Getting your call ready. Allow microphone or camera access when prompted.</span><Button variant="secondary" onClick={() => calls.close()}>Cancel</Button></Notice>}

      <GlassPanel className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={`${active ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-white/75 bg-white/15 md:w-72 md:border-r xl:w-80 2xl:w-[350px]`}>
          <div className="flex items-center justify-between px-6 pt-7 pb-5">
            <div><Eyebrow>YOUR INNER CIRCLE</Eyebrow><h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight">Messages<span className="rounded-md bg-lavender-100 px-2 py-1 font-sans text-[10px] font-semibold tracking-normal text-lavender-700">{conversations.length}</span></h1></div>
            <IconButton label={showNew ? "Close new conversation" : "New conversation"} onClick={() => setShowNew(!showNew)}><Icon name={showNew ? "close" : "plus"} /></IconButton>
          </div>

          <label className="mx-6 flex items-center gap-2.5 rounded-xl border border-white/80 bg-white/45 px-3 text-muted focus-within:ring-2 focus-within:ring-lavender-300">
            <Icon name="search" size={18} /><input className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none placeholder:text-faint" aria-label="Search conversations" placeholder="Find a conversation" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {showNew && <form className="mx-6 mt-3 rounded-xl border border-white bg-white/55 p-3" onSubmit={handleStartConversation}>
            <label htmlFor="contact-email" className="text-xs font-medium">Say hello to someone</label>
            <div className="mt-2.5 flex items-center gap-2"><Input id="contact-email" ref={emailRef} type="email" required placeholder="Their email address" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} /><IconButton label="Start conversation" type="submit" disabled={starting}><Icon name="send" size={17} /></IconButton></div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">They’ll need a Hush account first.</p>
          </form>}
          {error && <Notice tone="error" className="mx-4 mt-3"><span className="flex-1">{error}</span><button className="font-semibold underline" onClick={() => void refreshConversations()}>Retry</button></Notice>}

          <div className="flex items-center justify-between px-7 pt-7 pb-3 text-[9px] font-semibold tracking-widest text-muted"><span>ALL CONVERSATIONS</span><Icon name="chat" size={14} /></div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-3">
            {visible.map((c) => <li key={c.id}>
              <button className={`my-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-3.5 text-left transition ${c.id === activeId ? "border-white/90 bg-linear-to-r from-lavender-100/90 to-white/40 shadow-sm shadow-lavender-700/5" : "border-transparent hover:bg-white/50"}`} onClick={() => setActiveId(c.id)} aria-current={c.id === activeId ? "true" : undefined}>
                <Avatar name={c.other.displayName} />
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{c.other.displayName}</strong><span className="mt-1.5 block text-[11px] text-muted">{c.unreadCount ? `${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}` : "Open your conversation"}</span></span>
                {c.unreadCount > 0 && <span className="min-w-5 rounded-md bg-lavender-600 px-1.5 py-0.5 text-center text-[10px] text-white">{c.unreadCount}</span>}
              </button>
            </li>)}
            {!visible.length && <li className="px-5 py-10 text-center text-xs leading-7 text-muted"><span className="inline-flex text-lavender-400"><Icon name={search ? "search" : "chat"} size={28} /></span><p className="mt-3">{loading ? "Finding your conversations…" : search ? "No conversations found." : "Your next hello starts here."}</p>{!loading && !search && <button className="mt-1 font-semibold text-lavender-700 hover:underline" onClick={() => setShowNew(true)}>Start a conversation</button>}</li>}
          </ul>
          <div className="mx-6 my-4 flex items-center gap-3 rounded-xl border border-white/70 bg-linear-to-r from-lavender-100/30 to-mint-100/30 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/65 text-lavender-600"><Icon name="phone" size={18} /></span>
            <p className="text-[10px] leading-5 text-muted">Some things are better said.<br /><strong className="font-medium text-ink">Make time for a call.</strong></p>
          </div>
          <div className="flex items-center gap-3 border-t border-white/70 bg-white/15 px-6 py-4">
            <Avatar name={user?.displayName || "You"} small />
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold">{user?.displayName}</strong><span className="mt-1 block truncate text-[10px] text-muted">{user?.email}</span></div>
            <IconButton label="Log out" onClick={logout}><Icon name="logout" size={18} /></IconButton>
          </div>
        </aside>

        <main className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-linear-to-br from-white/5 to-white/25`}>
          {active ? <ChatWindow key={active.id} conversationId={active.id} otherName={active.other.displayName} connected={connected} callDisabled={Boolean(calls.call) || calls.preparing || !connected} onStartCall={(mode) => void calls.start(active.id, mode)} onBack={() => setActiveId(null)} onRead={() => markConversationRead(active.id)} /> : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
              <span className="relative mb-8 grid h-42 w-48 shrink-0 place-items-center before:absolute before:inset-0 before:-rotate-25 before:rounded-[50%] before:border before:border-lavender-300/30 after:absolute after:inset-x-[-15px] after:inset-y-5 after:rotate-25 after:rounded-[50%] after:border after:border-lavender-300/30">
                <span className="grid size-27 -rotate-8 place-items-center rounded-[36px] border border-white bg-linear-to-br from-lavender-100/80 to-lavender-200/40 text-lavender-500 shadow-glass"><Icon name="chat" size={48} /></span>
                <span className="absolute top-2 right-1 text-mint-500"><Icon name="spark" size={24} /></span>
              </span>
              <Eyebrow>MESSAGES THAT MEAN SOMETHING</Eyebrow>
              <h2 className="my-4 text-2xl font-semibold tracking-tight text-lavender-800 xl:text-[33px]">A hello goes a long way.</h2>
              <p className="text-xs leading-6 text-muted">Choose a conversation or reach out to someone new.<br />Your people are only a message away.</p>
              <Button className="mt-6" onClick={() => setShowNew(true)}><Icon name="plus" size={18} />Start a conversation</Button>
              <div className="mt-14 flex flex-wrap justify-center gap-5 text-[10px] text-muted"><span className="flex items-center gap-2"><Icon name="chat" size={17} />Little check-ins</span><span className="flex items-center gap-2"><Icon name="phone" size={17} />Long catch-ups</span><span className="flex items-center gap-2"><Icon name="video" size={17} />Face to face</span></div>
            </div>
          )}
        </main>
      </GlassPanel>

      <footer className="flex h-9 shrink-0 items-center justify-between text-[9px] text-muted md:h-12"><span className="text-[7px] tracking-widest md:text-[8px]">MADE FOR MEANINGFUL CONNECTIONS</span><span>Text. Talk. Be there.</span></footer>

      {calls.call && calls.call.phase !== "active" && (
        <CallDialog labelledBy="ringing-title" onClose={() => calls.close()}>
          <GlassPanel className="w-full max-w-[430px] bg-lavender-50/95 px-7 py-10 text-center">
            <Eyebrow>{calls.call.phase === "incoming" ? "SOMEONE’S THINKING OF YOU" : "A MOMENT TO CONNECT"}</Eyebrow>
            <div className="mx-auto mt-9 mb-6 w-fit animate-ring rounded-[29px]"><Avatar name={callPerson} large /></div>
            <h2 id="ringing-title" className="text-2xl font-semibold wrap-anywhere">{callPerson}</h2>
            <p className="mt-2.5 text-sm text-muted">{calls.call.phase === "incoming" ? `Incoming ${calls.call.mode} call` : calls.call.phase === "outgoing" ? `Ringing · ${calls.call.mode} call` : "Connecting your call…"}</p>
            <div className="mt-8 flex justify-center gap-4">
              {calls.call.phase === "incoming" ? <><Button variant="danger" onClick={calls.decline}><Icon name="close" />Decline</Button><Button autoFocus variant="accept" onClick={() => void calls.accept()}><Icon name={calls.call.mode === "voice" ? "phone" : "video"} />Accept</Button></> : <Button autoFocus variant="danger" onClick={() => calls.close()}><Icon name="close" />Cancel call</Button>}
            </div>
          </GlassPanel>
        </CallDialog>
      )}
      {calls.call?.phase === "active" && calls.call.token && calls.call.url && (
        <Suspense fallback={<CallDialog labelledBy="loading-call-title" onClose={() => calls.close()}><GlassPanel className="bg-lavender-50 p-8 text-center"><h2 id="loading-call-title" className="mb-5">Opening your call…</h2><Button variant="danger" onClick={() => calls.close()}>Cancel call</Button></GlassPanel></CallDialog>}>
          <CallModal token={calls.call.token} serverUrl={calls.call.url} mode={calls.call.mode} otherName={callPerson} onLeave={() => calls.close()} onError={(message) => calls.close(message)} />
        </Suspense>
      )}
    </div>
  );
}
