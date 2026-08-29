// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ajvanbeest.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  markdown: {
    // Gruvbox-compatible code themes for both modes (spec B5). Dual themes emit
    // --shiki-light/--shiki-dark custom properties; global.css switches on data-theme.
    shikiConfig: {
      themes: { light: 'gruvbox-light-medium', dark: 'gruvbox-dark-medium' },
      defaultColor: false,
    },
  },
});
