/** GitHub API base URL */
export const GITHUB_API_BASE = 'https://api.github.com';

/** Cache TTL in milliseconds (1 hour) */
export const CACHE_TTL_MS = 60 * 60 * 1000;

/** CSS class to mark commit rows that have already been processed */
export const TAGGED_CLASS = 'commit-tagger-processed';

/** CSS class for the tag badge container */
export const BADGE_CONTAINER_CLASS = 'commit-tagger-badges';

/** Selector for commit links containing full SHA */
export const COMMIT_LINK_SELECTOR = 'a[href*="/commit/"]';

/** GitHub API tags per page (max 100) */
export const TAGS_PER_PAGE = 100;

/** Storage key for GitHub PAT */
export const TOKEN_STORAGE_KEY = 'github_pat';

/** Prefix for cache storage keys */
export const CACHE_KEY_PREFIX = 'tag_cache_';

/** Debounce delay for MutationObserver (ms) */
export const MUTATION_DEBOUNCE_MS = 300;

/** Timeout for page-context tag fetch via MAIN world (ms) */
export const PAGE_FETCH_TIMEOUT_MS = 8000;
