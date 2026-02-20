import { clearAllCaches } from '~/utils/cache';

const clearCacheBtn = document.getElementById('clear-cache') as HTMLButtonElement;
const cacheStatus = document.getElementById('cache-status') as HTMLDivElement;

// Clear cache
clearCacheBtn.addEventListener('click', async () => {
  await clearAllCaches();
  cacheStatus.textContent = 'Cache cleared!';
  cacheStatus.className = 'status success';
  setTimeout(() => {
    cacheStatus.textContent = '';
  }, 2000);
});
