import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import { Button, Eyebrow, Input, Notice } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try { await login(email, password); navigate("/"); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Eyebrow>YOUR PEOPLE ARE HERE</Eyebrow>
        <div><h2 className="text-[28px] font-semibold tracking-tight">Welcome back.</h2><p className="mt-2 mb-2 text-sm text-muted">Pick up right where you left off.</p></div>
        <label className="flex flex-col gap-2.5 text-xs font-medium text-muted">Email address<Input placeholder="you@example.com" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="flex flex-col gap-2.5 text-xs font-medium text-muted">Password<Input placeholder="Enter your password" autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={loading} className="mt-1">{loading ? "Signing in…" : "Let's talk"}<Icon name="send" size={18} /></Button>
        <p className="mt-1 text-center text-xs leading-6 text-muted">New around here? <Link className="font-semibold text-lavender-700 hover:underline" to="/signup">Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}
