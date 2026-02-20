/**
 * MAIN world content script: runs in the page's JavaScript context.
 * This allows fetch() calls to include GitHub's session cookies,
 * enabling tag data retrieval without a Personal Access Token.
 */
export default defineContentScript({
  matches: ['https://github.com/*/*/commits/*'],
  world: 'MAIN',

  main() {
    window.addEventListener('message', async (event) => {
      if (event.data?.type !== 'CT_FETCH_TAGS') return;

      const { owner, repo, requestId } = event.data;

      try {
        const tagMap = await fetchAllTagsFromPage(owner, repo);
        window.postMessage(
          { type: 'CT_TAGS_RESULT', tagMap, success: true, requestId },
          '*',
        );
      } catch (error) {
        console.warn('[CommitTagger/MAIN] Page context fetch failed:', error);
        window.postMessage(
          { type: 'CT_TAGS_RESULT', tagMap: {}, success: false, requestId },
          '*',
        );
      }
    });
  },
});

interface TagEntry {
  name: string;
  sha: string;
}

/**
 * Fetch all tags by loading GitHub's /tags pages from the page context.
 * Session cookies are included automatically (same-origin request).
 */
async function fetchAllTagsFromPage(
  owner: string,
  repo: string,
): Promise<Record<string, string[]>> {
  const tagMap: Record<string, string[]> = {};
  let url: string | null = `/${owner}/${repo}/tags`;
  let pageCount = 0;
  const maxPages = 50;

  while (url && pageCount < maxPages) {
    const response = await fetch(url);

    if (!response.ok) {
      if (pageCount === 0) throw new Error(`HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const entries = extractTagsFromHtml(doc, owner, repo);
    if (entries.length === 0) break;

    for (const { name, sha } of entries) {
      if (!tagMap[sha]) tagMap[sha] = [];
      if (!tagMap[sha].includes(name)) {
        tagMap[sha].push(name);
      }
    }

    // GitHub uses rel="next" links with ?after= for pagination
    const nextLink = doc.querySelector<HTMLAnchorElement>('a[rel="next"]');
    url = nextLink?.getAttribute('href') ?? null;
    pageCount++;
  }

  return tagMap;
}

/**
 * Extract tag entries by parsing HTML links on the GitHub tags page.
 *
 * GitHub tags page structure:
 *   <div class="Box-row position-relative d-flex">
 *     <h2><a href="/{owner}/{repo}/releases/tag/{tag}">tag</a></h2>
 *     ...
 *     <a href="/{owner}/{repo}/commit/{sha}">...</a>
 *   </div>
 */
function extractTagsFromHtml(
  doc: Document,
  owner: string,
  repo: string,
): TagEntry[] {
  const results: TagEntry[] = [];
  const repoPath = `/${owner}/${repo}`;
  const seen = new Set<string>();

  // Each tag entry lives inside a .Box-row container
  const rows = doc.querySelectorAll('.Box-row');

  for (const row of rows) {
    // Find the tag name from a /releases/tag/ link
    const tagLink = row.querySelector<HTMLAnchorElement>(
      `a[href*="${repoPath}/releases/tag/"]`,
    );
    if (!tagLink) continue;

    const tagHref = tagLink.getAttribute('href') ?? '';
    const tagMatch = tagHref.match(/\/releases\/tag\/(.+)$/);
    if (!tagMatch) continue;

    const name = decodeURIComponent(tagMatch[1]);

    // Find the associated commit SHA
    const commitLink = row.querySelector<HTMLAnchorElement>(
      `a[href*="${repoPath}/commit/"]`,
    );
    if (!commitLink) continue;

    const commitHref = commitLink.getAttribute('href') ?? '';
    const shaMatch = commitHref.match(/\/commit\/([0-9a-f]{7,40})/);
    if (!shaMatch) continue;

    const key = `${name}:${shaMatch[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ name, sha: shaMatch[1] });
  }

  return results;
}
