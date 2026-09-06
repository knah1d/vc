import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";

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
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout><form onSubmit={handleSubmit} className="auth-form">
      <span className="eyebrow">YOUR PEOPLE ARE HERE</span>
      <h2>Welcome back.</h2><p className="muted">Pick up right where you left off.</p>
      <label>Email address<input placeholder="you@example.com" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input
        placeholder="Enter your password"
        autoComplete="current-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "Signing in…" : "Let's talk"}<Icon name="send" size={18} /></button>
      <p className="auth-switch">
        New around here? <Link to="/signup">Create an account</Link>
      </p>
    </form></AuthLayout>
  );
}
