import { cachedFetch } from './lib/apiCache';

const API = import.meta.env.VITE_API_BASE_URL;

if (!API) {
  console.error('VITE_API_BASE_URL is not defined');
}

export async function getScoreboard() {
  try {
    if (!API) {
      throw new Error('VITE_API_BASE_URL is not defined');
    }

    const url = `${API.replace(/\/$/, '')}/scoreboard`;
    console.log('Fetching scoreboard from:', url);

    const data = await cachedFetch(url, 30_000);
    console.log(data);
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}
