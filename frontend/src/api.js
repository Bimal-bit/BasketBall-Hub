const API = import.meta.env.VITE_API_BASE_URL;

if (!API) {
  console.error('VITE_API_BASE_URL is not defined');
}

export async function getScoreboard() {
  try {
    if (!API) {
      throw new Error('VITE_API_BASE_URL is not defined');
    }

    const res = await fetch(`${API.replace(/\/$/, '')}/scoreboard`);

    if (!res.ok) {
      throw new Error(`Failed to fetch scoreboard: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log(data);
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}
