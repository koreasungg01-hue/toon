// frontend/src/services/api.js

import { auth } from "../firebase/firebase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

async function request(path, options = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("먼저 로그인해라.");
  }

  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `요청 실패 (${response.status})`
    );
  }

  return data;
}

export const api = {
  get(path) {
    return request(path);
  },

  post(path, body = {}) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
