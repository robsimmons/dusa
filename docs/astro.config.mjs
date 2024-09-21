import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://dusa.rocks',
  locale: 'https://google.com/',
  integrations: [
    starlight({
      title: 'Dusa',
      description: 'Documentation for the Dusa language',
      social: {
        github: 'https://github.com/robsimmons/dusa',
      },
      editLink: {
        baseUrl: 'https://git.sr.ht/~robsimmons/dusa/tree/main/item/docs/',
      },
      customCss: [
        './src/custom.css',
        '@fontsource/fira-mono/400.css',
        '@fontsource/fira-mono/500.css',
        '@fontsource/fira-mono/700.css',
        '@fontsource/fira-sans/100.css',
        '@fontsource/fira-sans/200.css',
        '@fontsource/fira-sans/300.css',
        '@fontsource/fira-sans/400.css',
        '@fontsource/fira-sans/500.css',
        '@fontsource/fira-sans/600.css',
        '@fontsource/fira-sans/700.css',
        '@fontsource/fira-sans/800.css',
        '@fontsource/fira-sans-condensed/400.css',
      ],
      head: [
        { tag: 'link', attrs: { rel: 'icon', href: '/dusa-icon-2.svg' } },
        { tag: 'link', attrs: { rel: 'shortcut icon', href: '/dusa-icon-2.svg' } },
        { tag: 'link', attrs: { rel: 'mask-icon', href: '/dusa-icon-2.svg', color: '#158f44' } },
      ],
      sidebar: [
        {
          label: 'Dusa is...',
          items: [
            { label: 'Graph exploration', link: '/docs/introductions/graph/' },
            { label: 'Datalog', link: '/docs/introductions/datalog/' },
            { label: 'Answer set programming', link: '/docs/introductions/asp/' },
          ],
        },
        {
          label: 'Language Reference',
          items: [
            { label: 'Declarations', link: '/docs/language/declarations/' },
            { label: 'Facts', link: '/docs/language/facts/' },
            { label: 'Choices', link: '/docs/language/choice/' },
            { label: 'Rules', link: '/docs/language/rules/' },
            { label: 'Terms and variables', link: '/docs/language/terms/' },
            { label: 'Constraints', link: '/docs/language/constraints/' },
            { label: 'Builtins', link: '/docs/language/builtin/' },
            { label: 'Syntax specification', link: '/docs/language/syntax/' },
          ],
        },
        {
          label: 'JavaScript API',
          items: [
            { label: 'class Dusa', link: '/docs/api/dusa/' },
            { label: 'class DusaSolution', link: '/docs/api/dusasolution/' },
            { label: 'Terms', link: '/docs/api/terms/' },
          ],
        },
      ],
    }),
  ],
});
