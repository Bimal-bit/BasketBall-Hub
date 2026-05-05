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

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch scoreboard: ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Expected JSON from ${url}, but received ${contentType || 'unknown content type'}: ${text.slice(0, 80)}`);
    }

    const data = await res.json();
    console.log(data);
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}
