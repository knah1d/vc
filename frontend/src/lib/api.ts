const API_URL = import.meta.env.VITE_API_URL as string;

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ? JSON.stringify(data.error) : `Request failed: ${res.status}`);
  }
  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; displayName: string };
}

export const api = {
  signup: (email: string, password: string, displayName: string) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, displayName }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  startConversation: (otherEmail: string) =>
    request<{ conversation: { id: string } }>("/conversations", {
      method: "POST",
      body: JSON.stringify({ otherEmail }),
    }),
  listConversations: () =>
    request<{ conversations: Array<{ id: string; other: { id: string; displayName: string }; createdAt: string }> }>(
      "/conversations"
    ),
  listMessages: (conversationId: string) =>
    request<{ messages: Array<{ id: string; senderId: string; body: string; createdAt: string }> }>(
      `/conversations/${conversationId}/messages`
    ),
  getVideoToken: (conversationId: string) =>
    request<{ token: string; url: string }>(`/video/token/${conversationId}`, { method: "POST" }),
};

export { getToken };
