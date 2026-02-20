import { GITHUB_API_BASE, TAGS_PER_PAGE } from './constants';
import type { TagMap } from './messaging';

interface GitHubTag {
  name: string;
  commit: {
    sha: string;
  };
}

/** Parse Link header to extract the next page URL */
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

/**
 * Fetch all tags for a repository via the GitHub REST API (unauthenticated).
 * Used as a fallback when page-context fetch fails.
 * Returns a map of commit SHA → tag name[].
 */
export async function fetchAllTags(owner: string, repo: string): Promise<TagMap> {
  const tagMap: TagMap = {};

  let url: string | null =
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/tags?per_page=${TAGS_PER_PAGE}`;

  while (url) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[CommitTagger] Repo not accessible via API (404).');
        return tagMap;
      }
      if (response.status === 403 || response.status === 429) {
        console.warn('[CommitTagger] Rate limited by GitHub API');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const tags: GitHubTag[] = await response.json();

    for (const tag of tags) {
      const sha = tag.commit.sha;
      if (!tagMap[sha]) {
        tagMap[sha] = [];
      }
      tagMap[sha].push(tag.name);
    }

    url = getNextPageUrl(response.headers.get('Link'));
  }

  return tagMap;
}
