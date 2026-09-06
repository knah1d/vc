import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";

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
    try {
      await signup(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout><form onSubmit={handleSubmit} className="auth-form">
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h2>Your circle starts here.</h2><p className="muted">A few details, a world of conversation.</p>
      <label>Your name<input
        placeholder="What should we call you?"
        autoComplete="nickname"
        maxLength={60}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      /></label>
      <label>Email address<input placeholder="you@example.com" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input
        placeholder="At least 8 characters"
        autoComplete="new-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "Creating your account…" : "Find your people"}<Icon name="send" size={18} /></button>
      <p className="auth-switch">
        Already part of the circle? <Link to="/login">Log in</Link>
      </p>
    </form></AuthLayout>
  );
}
