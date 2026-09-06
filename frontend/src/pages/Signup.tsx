import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signup(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: "4rem auto" }}>
      <h1>Sign up</h1>
      <input
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        placeholder="Password (min 8 chars)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Sign up</button>
      <p>
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
