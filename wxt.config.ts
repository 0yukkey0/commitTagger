import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'CommitTagger',
    description: 'Display tags on GitHub commit list pages',
    permissions: ['storage'],
    host_permissions: ['https://api.github.com/*'],
    icons: {
      '16': 'assets/icon/16.png',
      '32': 'assets/icon/32.png',
      '48': 'assets/icon/48.png',
      '128': 'assets/icon/128.png',
    },
  },
});
