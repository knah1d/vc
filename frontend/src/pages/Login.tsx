import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: "4rem auto" }}>
      <h1>Log in</h1>
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Log in</button>
      <p>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </form>
  );
}
