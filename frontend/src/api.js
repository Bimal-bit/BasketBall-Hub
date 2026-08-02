import { cachedFetch } from './lib/apiCache';

const LEGACY_TEMPLATE_API = 'https://basketball-hub-api.onrender.com/api';
const configuredApi = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const API = configuredApi && configuredApi !== LEGACY_TEMPLATE_API
  ? configuredApi
  : import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '';

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
