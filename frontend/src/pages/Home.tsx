import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useCalls } from "../lib/useCalls";
import { useAuth } from "../context/AuthContext";
import ChatWindow from "../components/ChatWindow";
import CallModal from "../components/CallModal";
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
  const [connected, setConnected] = useState(getSocket().connected);
  const emailRef = useRef<HTMLInputElement>(null);
  const calls = useCalls();

  async function refreshConversations() {
    try {
      const result = await api.listConversations();
      setConversations(result.conversations);
      setError(null);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  function markConversationRead(conversationId: string) {
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
  }

  useEffect(() => {
    void refreshConversations();
    const socket = getSocket();
    function onConnect() { setConnected(true); void refreshConversations(); }
    function onDisconnect() { setConnected(false); }
    function onMessageNew() { void refreshConversations(); }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onMessageNew);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onMessageNew);
    };
  }, []);

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
    <div className="workspace">
      <header className="app-topbar">
        <a href="/" className="brand"><span className="brand-mark"><Icon name="chat" size={22} /></span>hush<span className="brand-dot">.</span></a>
        <span className="topbar-caption">A little space for your people.</span>
        <span className="connection-status"><i className={connected ? "status-dot online" : "status-dot"} />{connected ? "Connected" : "Reconnecting…"}</span>
      </header>
      <div className={`messenger glass ${active ? "has-conversation" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-heading"><div><span className="eyebrow">YOUR INNER CIRCLE</span><h1>Messages<span className="count-chip">{conversations.length}</span></h1></div><button className="icon-button new-chat-button" aria-label="New conversation" title="New conversation" onClick={() => setShowNew(!showNew)}><Icon name={showNew ? "close" : "plus"} /></button></div>
          <label className="search-field"><Icon name="search" size={18} /><input aria-label="Search conversations" placeholder="Find a conversation" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          {showNew && <form className="new-chat-form" onSubmit={handleStartConversation}><label htmlFor="contact-email">Say hello to someone</label><div><input id="contact-email" ref={emailRef} type="email" required placeholder="Their email address" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} /><button className="icon-button accent-button" type="submit" disabled={starting} aria-label="Start conversation"><Icon name="send" size={17} /></button></div><small>They’ll need a Hush account first.</small></form>}
          {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => void refreshConversations()}>Retry</button></div>}
          <div className="list-label"><span>ALL CONVERSATIONS</span><Icon name="chat" size={14} /></div>
          <ul className="conversation-list">
            {visible.map((c) => <li key={c.id}><button className={`conversation-item ${c.id === activeId ? "selected" : ""}`} onClick={() => setActiveId(c.id)} aria-current={c.id === activeId ? "true" : undefined}><Avatar name={c.other.displayName} /><span className="conversation-copy"><strong>{c.other.displayName}</strong><span>{c.unreadCount ? `${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}` : "Open your conversation"}</span></span>{c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}</button></li>)}
            {!visible.length && <li className="sidebar-empty"><Icon name={search ? "search" : "chat"} size={28} /><p>{loading ? "Finding your conversations…" : search ? "No conversations found." : "Your next hello starts here."}</p>{!loading && !search && <button className="text-button" onClick={() => setShowNew(true)}>Start a conversation</button>}</li>}
          </ul>
          <div className="sidebar-note"><span className="note-icon"><Icon name="phone" size={18} /></span><p>Some things are better said.<br /><strong>Make time for a call.</strong></p></div>
          <div className="profile"><Avatar name={user?.displayName || "You"} /><div><strong>{user?.displayName}</strong><span>{user?.email}</span></div><button className="icon-button" onClick={logout} title="Log out" aria-label="Log out"><Icon name="logout" size={18} /></button></div>
        </aside>
        <main className="chat-main">
          {calls.notice && <div className="notice call-notice" role="status"><Icon name="phone" size={18} /><span>{calls.notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={calls.dismissNotice}><Icon name="close" size={16} /></button></div>}
          {calls.preparing && <div className="notice call-notice" role="status"><span>Getting your call ready. Allow access to your microphone{active ? " and camera if requested" : ""}.</span><button className="text-button" onClick={() => calls.close()}>Cancel</button></div>}
          {active ? <ChatWindow key={active.id} conversationId={active.id} otherName={active.other.displayName} connected={connected} callDisabled={Boolean(calls.call) || calls.preparing || !connected} onStartCall={(mode) => void calls.start(active.id, mode)} onBack={() => setActiveId(null)} onRead={() => markConversationRead(active.id)} /> : <div className="welcome-state"><span className="welcome-orbit"><span className="welcome-icon"><Icon name="chat" size={48} /></span><span className="orbit-spark"><Icon name="spark" size={24} /></span></span><span className="eyebrow">MESSAGES THAT MEAN SOMETHING</span><h2>A hello goes a long way.</h2><p>Choose a conversation or reach out to someone new.<br />Your people are only a message away.</p><button className="primary-button" onClick={() => setShowNew(true)}><Icon name="plus" size={18} />Start a conversation</button><div className="welcome-features"><span><Icon name="chat" size={17} />Little check-ins</span><span><Icon name="phone" size={17} />Long catch-ups</span><span><Icon name="video" size={17} />Face to face</span></div></div>}
        </main>
      </div>
      <footer className="workspace-footer"><span>MADE FOR MEANINGFUL CONNECTIONS</span><span>Text. Talk. Be there.</span></footer>
      {calls.call && calls.call.phase !== "active" && <div className="call-overlay"><section className="ringing-card glass" role="dialog" aria-modal="true" aria-labelledby="ringing-title"><span className="eyebrow">{calls.call.phase === "incoming" ? "SOMEONE’S THINKING OF YOU" : "A MOMENT TO CONNECT"}</span><div className="ringing-avatar"><Avatar name={callPerson} large /></div><h2 id="ringing-title">{callPerson}</h2><p>{calls.call.phase === "incoming" ? `Incoming ${calls.call.mode} call` : calls.call.phase === "outgoing" ? `Ringing · ${calls.call.mode} call` : "Connecting your call…"}</p><div className="ringing-actions">{calls.call.phase === "incoming" ? <><button className="danger-button" onClick={calls.decline}><Icon name="close" />Decline</button><button autoFocus className="primary-button accept-button" onClick={() => void calls.accept()}><Icon name={calls.call.mode === "voice" ? "phone" : "video"} />Accept</button></> : <button autoFocus className="danger-button" onClick={() => calls.close()}><Icon name="close" />Cancel call</button>}</div></section></div>}
      {calls.call?.phase === "active" && calls.call.token && calls.call.url && <CallModal token={calls.call.token} serverUrl={calls.call.url} mode={calls.call.mode} otherName={callPerson} onLeave={() => calls.close()} onError={(message) => calls.close(message)} />}
    </div>
  );
}
