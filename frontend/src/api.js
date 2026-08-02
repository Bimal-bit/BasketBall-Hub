import { cachedFetch } from './lib/apiCache';

const API = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '')).replace(/\/$/, '');

export async function getScoreboard() {
  if (!API) return [];

  try {
    const url = `${API}/scoreboard`;
    console.log('Fetching scoreboard from:', url);

    const data = await cachedFetch(url, 30_000);
    console.log(data);
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}
