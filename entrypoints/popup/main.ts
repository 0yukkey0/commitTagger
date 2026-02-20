import { TOKEN_STORAGE_KEY, GITHUB_API_BASE } from '~/utils/constants';
import { clearAllCaches } from '~/utils/cache';

const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const saveTokenBtn = document.getElementById('save-token') as HTMLButtonElement;
const tokenStatus = document.getElementById('token-status') as HTMLDivElement;
const clearCacheBtn = document.getElementById('clear-cache') as HTMLButtonElement;
const cacheStatus = document.getElementById('cache-status') as HTMLDivElement;
const rateInfo = document.getElementById('rate-info') as HTMLDivElement;

// Load existing token on popup open
async function loadToken(): Promise<void> {
  const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
  const token = result[TOKEN_STORAGE_KEY];
  if (token) {
    tokenInput.value = token;
    tokenStatus.textContent = 'Token is set';
    tokenStatus.className = 'status success';
  }
}

// Save token
saveTokenBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (token) {
    await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token });
    tokenStatus.textContent = 'Token saved!';
    tokenStatus.className = 'status success';
  } else {
    await chrome.storage.local.remove(TOKEN_STORAGE_KEY);
    tokenStatus.textContent = 'Token removed';
    tokenStatus.className = 'status';
  }
  await fetchRateLimit();
});

// Clear cache
clearCacheBtn.addEventListener('click', async () => {
  await clearAllCaches();
  cacheStatus.textContent = 'Cache cleared!';
  cacheStatus.className = 'status success';
  setTimeout(() => {
    cacheStatus.textContent = '';
  }, 2000);
});

// Fetch and display rate limit info
async function fetchRateLimit(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
    const token = result[TOKEN_STORAGE_KEY];

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, { headers });

    if (!response.ok) {
      rateInfo.textContent = 'Failed to fetch rate limit';
      return;
    }

    const data = await response.json();
    const core = data.resources.core;
    const resetDate = new Date(core.reset * 1000);
    const resetStr = resetDate.toLocaleTimeString();

    rateInfo.innerHTML =
      `<strong>${core.remaining}</strong> / ${core.limit} requests remaining<br>` +
      `Resets at ${resetStr}`;
  } catch {
    rateInfo.textContent = 'Unable to check rate limit';
  }
}

// Initialize
loadToken();
fetchRateLimit();
