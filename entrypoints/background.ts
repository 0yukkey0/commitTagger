import { onMessage } from '~/utils/messaging';
import { getCache, setCache, clearCache } from '~/utils/cache';
import { fetchAllTags } from '~/utils/github-api';
import type { TagMap } from '~/utils/messaging';

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

export default defineBackground(() => {
  onMessage('getTagsForCommits', async ({ data }) => {
    const { owner, repo, shas } = data;
    const cacheKey = `${owner}/${repo}`;

    // Check cache first
    let tagMap = await getCache<TagMap>(cacheKey);

    if (!tagMap) {
      try {
        tagMap = await fetchAllTags(owner, repo);
      } catch (error) {
        console.error('[CommitTagger] Failed to fetch tags:', error);
        return {};
      }
      await setCache(cacheKey, tagMap);
    }

    return filterByShas(tagMap, shas);
  });

  onMessage('getCachedTags', async ({ data }) => {
    const { owner, repo } = data;
    const cacheKey = `${owner}/${repo}`;
    return await getCache<TagMap>(cacheKey);
  });

  onMessage('cacheTagMap', async ({ data }) => {
    const { owner, repo, tagMap } = data;
    const cacheKey = `${owner}/${repo}`;
    await setCache(cacheKey, tagMap);
  });

  onMessage('clearRepoCache', async ({ data }) => {
    const { owner, repo } = data;
    await clearCache(`${owner}/${repo}`);
  });
});
