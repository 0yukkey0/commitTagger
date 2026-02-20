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
      if (event.source !== window) return;
      if (event.data?.type !== 'CT_FETCH_TAGS') return;

      const { owner, repo, requestId } = event.data;

      try {
        const tagMap = await fetchAllTagsFromPage(owner, repo);
        window.postMessage(
          { type: 'CT_TAGS_RESULT', tagMap, success: true, requestId },
          '*',
        );
      } catch (error) {
        console.warn('[CommitTagger] Page context fetch failed:', error);
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
  let page = 1;
  const maxPages = 50;

  while (page <= maxPages) {
    const url = `/${owner}/${repo}/tags?page=${page}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (page === 1) throw new Error(`HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    let entries: TagEntry[] = [];

    // Strategy 1: Extract from embedded React data (structured JSON)
    const embedded = doc.querySelector(
      'script[data-target="react-app.embeddedData"]',
    );
    if (embedded?.textContent) {
      try {
        const data = JSON.parse(embedded.textContent);
        entries = extractTagsFromJson(data);
      } catch {
        // JSON parse failed, fall through to HTML parsing
      }
    }

    // Strategy 2: Parse HTML links as fallback
    if (entries.length === 0) {
      entries = extractTagsFromHtml(doc, owner, repo);
    }

    if (entries.length === 0) break;

    for (const { name, sha } of entries) {
      if (!tagMap[sha]) tagMap[sha] = [];
      if (!tagMap[sha].includes(name)) {
        tagMap[sha].push(name);
      }
    }

    // Check for next page
    const hasNext =
      doc.querySelector('a[rel="next"]') ??
      doc.querySelector('.pagination a:last-child:not(.disabled)');
    if (!hasNext) break;

    page++;
  }

  return tagMap;
}

/** Extract tag entries from GitHub's embedded React JSON data */
function extractTagsFromJson(data: unknown): TagEntry[] {
  const results: TagEntry[] = [];
  if (!data || typeof data !== 'object') return results;

  const obj = data as Record<string, unknown>;
  const payload = (obj.payload ?? obj) as Record<string, unknown>;

  // Try various JSON structures GitHub may use
  const candidates = [
    payload.refs,
    payload.tags,
    payload.releases,
    (payload as any)?.data?.repository?.refs?.edges,
    (payload as any)?.data?.repository?.refs?.nodes,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      if (!item || typeof item !== 'object') continue;
      const entry = ((item as any).node ?? item) as Record<string, unknown>;
      const name = (entry.name ?? entry.tagName ?? entry.tag) as
        | string
        | undefined;
      const target = entry.target as Record<string, unknown> | undefined;
      const commit = entry.commit as Record<string, unknown> | undefined;
      const sha = (target?.oid ??
        target?.commitSha ??
        commit?.sha ??
        entry.sha) as string | undefined;
      if (name && sha) {
        results.push({ name, sha });
      }
    }
  }

  return results;
}

/** Extract tag entries by parsing HTML links on the tags page */
function extractTagsFromHtml(
  doc: Document,
  owner: string,
  repo: string,
): TagEntry[] {
  const results: TagEntry[] = [];
  const repoPath = `/${owner}/${repo}`;

  const tagLinks = doc.querySelectorAll<HTMLAnchorElement>(
    `a[href*="${repoPath}/releases/tag/"]`,
  );

  for (const tagLink of tagLinks) {
    const href = tagLink.getAttribute('href') ?? '';
    const tagMatch = href.match(/\/releases\/tag\/(.+)$/);
    if (!tagMatch) continue;

    const name = decodeURIComponent(tagMatch[1]);

    // Find associated commit SHA in a nearby container
    const container =
      tagLink.closest(
        '[class*="Box-row"], [class*="row"], li, section, [data-testid]',
      ) ?? tagLink.parentElement?.parentElement;
    if (!container) continue;

    const commitLink = container.querySelector<HTMLAnchorElement>(
      `a[href*="${repoPath}/commit/"]`,
    );
    if (!commitLink) continue;

    const commitHref = commitLink.getAttribute('href') ?? '';
    const shaMatch = commitHref.match(/\/commit\/([0-9a-f]{7,40})/);
    if (shaMatch) {
      results.push({ name, sha: shaMatch[1] });
    }
  }

  return results;
}
