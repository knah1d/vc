import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import { Button, Eyebrow, Input, Notice } from "../components/ui";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try { await signup(email, password, displayName.trim()); navigate("/"); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Eyebrow>MAKE YOURSELF AT HOME</Eyebrow>
        <div><h2 className="text-[27px] font-semibold tracking-tight">Your circle starts here.</h2><p className="mt-2 mb-2 text-sm leading-relaxed text-muted">A few details, a world of conversation.</p></div>
        <label className="flex flex-col gap-2.5 text-xs font-medium text-muted">Your name<Input placeholder="What should we call you?" autoComplete="nickname" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
        <label className="flex flex-col gap-2.5 text-xs font-medium text-muted">Email address<Input placeholder="you@example.com" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="flex flex-col gap-2.5 text-xs font-medium text-muted">Password<Input placeholder="At least 8 characters" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={loading} className="mt-1">{loading ? "Creating your account…" : "Find your people"}<Icon name="send" size={18} /></Button>
        <p className="mt-1 text-center text-xs leading-6 text-muted">Already part of the circle? <Link className="font-semibold text-lavender-700 hover:underline" to="/login">Log in</Link></p>
      </form>
    </AuthLayout>
  );
}
