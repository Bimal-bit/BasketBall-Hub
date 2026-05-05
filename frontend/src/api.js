const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getApiUrl(path) {
  if (!API_BASE_URL) {
    console.error('VITE_API_BASE_URL is not defined');
    throw new Error('VITE_API_BASE_URL is not defined');
  }

  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export async function getScoreboard() {
  const response = await fetch(getApiUrl('/scoreboard'));

  if (!response.ok) {
    throw new Error(`Failed to fetch scoreboard: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
