import { cachedFetch } from './lib/apiCache';

const API = (import.meta.env.VITE_API_BASE_URL || 'https://basketball-hub-api.onrender.com/api').replace(/\/$/, '');

export async function getScoreboard() {
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
