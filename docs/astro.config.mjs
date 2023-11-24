import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
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
            { label: 'Terms and variables', link: '/docs/language/terms/' },
            { label: 'Facts', link: '/docs/language/facts/' },
            { label: 'Rules', link: '/docs/language/rules/' },
            { label: 'Constraints', link: '/docs/language/constraints/' },
            { label: 'Builtins', link: '/docs/language/builtin/' },
            { label: 'Syntax specification', link: '/docs/language/syntax/' },
          ],
        },
      ],
    }),
  ],
});
