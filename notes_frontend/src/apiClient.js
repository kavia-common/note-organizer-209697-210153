// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /** Return API base URL from environment (fallback to local dev). */
  return (process.env.REACT_APP_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
}

const TOKEN_KEY = "notes_token";

// PUBLIC_INTERFACE
export function getToken() {
  /** Get persisted auth token. */
  return localStorage.getItem(TOKEN_KEY);
}

// PUBLIC_INTERFACE
export function setToken(token) {
  /** Persist auth token (or clear when null). */
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

async function request(path, { method = "GET", body, token } = {}) {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = { "Content-Type": "application/json" };
  const authToken = token ?? getToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// PUBLIC_INTERFACE
export const api = {
  /** Auth */
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),

  /** Folders */
  listFolders: () => request("/folders"),
  createFolder: (payload) => request("/folders", { method: "POST", body: payload }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: "DELETE" }),

  /** Notes */
  listNotes: (folderId) =>
    request(folderId ? `/notes?folder_id=${encodeURIComponent(folderId)}` : "/notes"),
  createNote: (payload) => request("/notes", { method: "POST", body: payload }),
  updateNote: (id, payload) => request(`/notes/${id}`, { method: "PATCH", body: payload }),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),
};
