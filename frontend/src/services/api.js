
import { auth } from '../firebase/firebase';

const API_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export async function api(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || '서버 요청에 실패했다.');
  }

  return result;
}
