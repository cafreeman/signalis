import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Signalis',
  description: 'A lightweight library for reactivity',
  base: '/signalis/',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Core API', link: '/core/' },
      { text: 'React', link: '/react/' },
      { text: 'Examples', link: '/examples/stopwatch' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Core Concepts', link: '/guide/core-concepts' },
          ],
        },
      ],
      '/core/': [
        {
          text: 'Core API',
          items: [
            { text: 'Overview', link: '/core/' },
            { text: 'Signals', link: '/core/signals' },
            { text: 'Derived', link: '/core/derived' },
            { text: 'Effects', link: '/core/effects' },
            { text: 'Resources', link: '/core/resources' },
            { text: 'Stores', link: '/core/stores' },
            { text: 'Utilities', link: '/core/utilities' },
          ],
        },
      ],
      '/react/': [
        {
          text: 'React Integration',
          items: [
            { text: 'Overview', link: '/react/' },
            { text: 'reactor', link: '/react/reactor' },
            { text: 'useSignal', link: '/react/use-signal' },
            { text: 'useDerived', link: '/react/use-derived' },
            { text: 'useSignalEffect', link: '/react/use-signal-effect' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Stopwatch', link: '/examples/stopwatch' },
            { text: 'Todo List', link: '/examples/todo-list' },
            { text: 'Async Data', link: '/examples/async-data' },
            { text: 'Composition', link: '/examples/composition' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cafreeman/signalis' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@signalis/core' },
    ],

    editLink: {
      pattern: 'https://github.com/cafreeman/signalis/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Chris Freeman',
    },
  },

  lastUpdated: true,

  sitemap: {
    hostname: 'https://cafreeman.github.io/signalis/',
  },
});
