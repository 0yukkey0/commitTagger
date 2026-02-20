import { sendMessage } from '~/utils/messaging';
import type { TagMap } from '~/utils/messaging';
import {
  TAGGED_CLASS,
  BADGE_CONTAINER_CLASS,
  COMMIT_LINK_SELECTOR,
  MUTATION_DEBOUNCE_MS,
  PAGE_FETCH_TIMEOUT_MS,
} from '~/utils/constants';
import './github-commits.content/style.css';

export default defineContentScript({
  matches: ['https://github.com/*/*/commits/*'],

  async main() {
    await processCommits();
    observeNavigationChanges();
  },
});

/** Extract owner/repo from the current URL */
function getRepoInfo(): { owner: string; repo: string } | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/commits\//);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Extract full commit SHAs from the page */
function extractCommitShas(): Map<string, HTMLElement> {
  const shaMap = new Map<string, HTMLElement>();
  const links = document.querySelectorAll<HTMLAnchorElement>(COMMIT_LINK_SELECTOR);

  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    // Match full 40-char SHA, or shorter SHA (7+) at end of path
    const match = href.match(/\/commit\/([0-9a-f]{7,40})(?:\?[^]*)?$/);
    if (!match) continue;

    const sha = match[1];
    // Find the closest commit row container
    const row = link.closest('li') ?? link.closest('[data-testid]') ?? link.parentElement;
    if (row && !row.classList.contains(TAGGED_CLASS)) {
      shaMap.set(sha, row);
    }
  }

  return shaMap;
}

/** Filter a full tag map by requested SHAs, supporting short SHA prefix matching */
function filterByShas(tagMap: TagMap, shas: string[]): TagMap {
  const result: TagMap = {};
  const fullShas = Object.keys(tagMap);
  for (const sha of shas) {
    if (tagMap[sha]) {
      result[sha] = tagMap[sha];
    } else if (sha.length < 40) {
      const matched = fullShas.find((full) => full.startsWith(sha));
      if (matched) {
        result[sha] = tagMap[matched];
      }
    }
  }
  return result;
}

/** Inject tag badges into a commit row */
function injectBadges(row: HTMLElement, tags: string[], owner: string, repo: string): void {
  const container = document.createElement('span');
  container.className = BADGE_CONTAINER_CLASS;

  for (const tag of tags) {
    const badge = document.createElement('a');
    badge.className = 'commit-tagger-badge';
    badge.textContent = `🏷 ${tag}`;
    badge.href = `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(tag)}`;
    badge.title = `Tag: ${tag}`;
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
    container.appendChild(badge);
  }

  // Insert the badge container. Try to find a good insertion point.
  // Look for the commit message area or just append to the row.
  const messageEl =
    row.querySelector('h4') ??
    row.querySelector('p') ??
    row.querySelector('a[data-testid="commit-message"]') ??
    row.querySelector(`${COMMIT_LINK_SELECTOR}`);

  if (messageEl && messageEl.parentElement) {
    messageEl.parentElement.insertBefore(container, messageEl.nextSibling);
  } else {
    row.appendChild(container);
  }
}

/**
 * Request tag data from the MAIN world content script via postMessage.
 * The MAIN world script fetches GitHub's /tags pages with session cookies.
 */
function fetchTagsViaPageContext(
  owner: string,
  repo: string,
): Promise<TagMap | null> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, PAGE_FETCH_TIMEOUT_MS);

    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type !== 'CT_TAGS_RESULT') return;
      if (event.data.requestId !== requestId) return;

      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve(event.data.success ? event.data.tagMap : null);
    }

    window.addEventListener('message', handler);

    // Small delay to ensure MAIN world script is initialized
    setTimeout(() => {
      window.postMessage({ type: 'CT_FETCH_TAGS', owner, repo, requestId }, '*');
    }, 100);
  });
}

/** Main processing: extract SHAs, fetch tags, inject badges */
async function processCommits(): Promise<void> {
  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  const shaMap = extractCommitShas();
  if (shaMap.size === 0) return;

  const shas = Array.from(shaMap.keys());
  const { owner, repo } = repoInfo;

  try {
    let tagMap: TagMap | null = null;

    // 1. Check cache first (instant)
    const cached = await sendMessage('getCachedTags', { owner, repo });
    if (cached) {
      tagMap = filterByShas(cached, shas);
    } else {
      // 2. Try page-context fetch (uses session cookies)
      const pageResult = await fetchTagsViaPageContext(owner, repo);
      if (pageResult && Object.keys(pageResult).length > 0) {
        // Cache the full tag map for subsequent navigations
        sendMessage('cacheTagMap', { owner, repo, tagMap: pageResult }).catch(() => {});
        tagMap = filterByShas(pageResult, shas);
      } else {
        // 3. Fallback to REST API via background
        tagMap = await sendMessage('getTagsForCommits', { owner, repo, shas });
      }
    }

    for (const [sha, row] of shaMap) {
      row.classList.add(TAGGED_CLASS);
      const tags = tagMap?.[sha];
      if (tags && tags.length > 0) {
        injectBadges(row, tags, owner, repo);
      }
    }
  } catch (error) {
    console.error('[CommitTagger] Failed to get tags:', error);
  }
}

/** Set up observers for SPA navigation changes */
function observeNavigationChanges(): void {
  // 1. GitHub Turbo navigation
  document.addEventListener('turbo:load', () => {
    processCommits();
  });

  // 2. WXT built-in location change
  window.addEventListener('wxt:locationchange', () => {
    processCommits();
  });

  // 3. MutationObserver fallback with debounce
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processCommits();
    }, MUTATION_DEBOUNCE_MS);
  });

  // Observe the main content area
  const target = document.querySelector('main') ?? document.body;
  observer.observe(target, {
    childList: true,
    subtree: true,
  });
}
