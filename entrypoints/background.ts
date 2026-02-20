import { onMessage } from '~/utils/messaging';
import { getCache, setCache, clearCache } from '~/utils/cache';
import { fetchAllTags } from '~/utils/github-api';

export default defineBackground(() => {
  onMessage('getTagsForCommits', async ({ data }) => {
    const { owner, repo, shas } = data;
    const cacheKey = `${owner}/${repo}`;

    // Check cache first
    let tagMap = await getCache<Record<string, string[]>>(cacheKey);

    if (!tagMap) {
      try {
        tagMap = await fetchAllTags(owner, repo);
      } catch (error) {
        console.error('[CommitTagger] Failed to fetch tags:', error);
        return {};
      }
      await setCache(cacheKey, tagMap);
    }

    // Return only the requested SHAs
    // Support prefix matching: page may show short SHAs while API returns full SHAs
    const result: Record<string, string[]> = {};
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
  });

  onMessage('clearRepoCache', async ({ data }) => {
    const { owner, repo } = data;
    await clearCache(`${owner}/${repo}`);
  });
});
