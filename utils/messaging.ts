import { defineExtensionMessaging } from '@webext-core/messaging';

/** Map of commit SHA to array of tag names */
export type TagMap = Record<string, string[]>;

interface ProtocolMap {
  getTagsForCommits(data: {
    owner: string;
    repo: string;
    shas: string[];
  }): TagMap;

  getCachedTags(data: {
    owner: string;
    repo: string;
  }): TagMap | null;

  cacheTagMap(data: {
    owner: string;
    repo: string;
    tagMap: TagMap;
  }): void;

  clearRepoCache(data: { owner: string; repo: string }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
