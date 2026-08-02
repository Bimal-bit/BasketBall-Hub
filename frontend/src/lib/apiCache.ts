type CacheEntry = {
  data: unknown;
  expires: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const RETRY_DELAY_MS = 800;
const MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 8_000;

type CachedFetchOptions = RequestInit & {
  timeoutMs?: number;
};

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, options?: CachedFetchOptions): Promise<T> {
  let networkRetries = 0;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options || {};

  while (true) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const preview = (await response.text()).slice(0, 80);
        throw new Error(`Expected JSON from ${url}, received ${contentType || 'unknown content type'}: ${preview}`);
      }

      return await response.json() as T;
    } catch (error) {
      const isNetworkError = error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
      if (!isNetworkError || networkRetries >= MAX_RETRIES) throw error;

      networkRetries += 1;
      await delay(RETRY_DELAY_MS);
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export async function cachedFetch<T>(
  url: string,
  ttlMs: number,
  options?: CachedFetchOptions
): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  const cacheKey = `${method}:${url}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > now) return cached.data as T;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const promise = fetchJson<T>(url, options)
    .then(data => {
      cache.set(cacheKey, { data, expires: Date.now() + ttlMs });
      return data;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

export function clearApiCache(url?: string) {
  if (!url) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.endsWith(url)) cache.delete(key);
  }
}
