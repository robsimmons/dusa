# Hello React!

[React](https://reactjs.org/) is a popular UI library for building web apps, usually single page apps. [Vite](https://vitejs.dev/) is a powerful tool for building javascript apps that bundles all of your code and shows immediate changes while you're editing. We're big fans!

While you're in the editor working, Glitch is running your `start` script in the background (`vite dev`). The site will be in dev mode and you'll see your changes happen 🪄 immediately in the preview window. Once you close the editor window and your app goes to sleep, Glitch runs the `build` script and Vite builds your app for modern browsers.

## What's in this project?

← `README.md`: That’s this file, where you can tell people what your cool website does and how you built it.

← `index.html`: This is the main page template React uses to build your site. When you're ready to share it or add a custom domain, change SEO/meta settings in here.

← `src/`: This folder contains all the files React will use to build your site.

### Working in the `src/` folder 📁

← `src/index.jsx`: This is the root of your React app. If you add libraries like [chakra-ui](https://chakra-ui.com) or [redux](https://react-redux.js.org), you'll insert their providers here. The `<HelmetProvider`> is an example of a provider you'd use.

← `src/app.jsx`: The base for your react app, here is where the magic really happens. The router (from [wouter](https://github.com/molefrog/wouter) 🐰) is imported here.

← `src/hooks/`: [Hooks](https://reactjs.org/docs/hooks-intro.html) are a powerful way to interact with your app. Included are two examples, `wiggle` and `prefers-reduced-motion`. You can use the wiggle on any of your elements!

← `src/pages/`: Pages to import to the router should go here!

← `src/components/router.jsx`: One of the most important parts of a single page app is the router. It's how we know what page to show. We're using [Wouter](https://github.com/molefrog/wouter), a small and easy router. You could replace it for something like [React Router](https://reactrouter.com/), but we really like wouter!

← `src/components/seo.jsx`: When you share your site on social media, you want to make sure the meta tags are correct and you've got an image. All of the settings for this file are in `src/seo.json`.

← `src/styles`: CSS files add styling rules to your content. You have [a lot of](https://vitejs.dev/guide/features.html#css) importing options for CSS including CSS modules if that's your jam.

![Glitch](https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576)

## You built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Want more details about React on Glitch? We've got a [Help Center article](https://help.glitch.com/kb/article/112) for you.
- Need more help? [Check out our Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
