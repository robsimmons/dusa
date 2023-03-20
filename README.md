# Hello React!

This project contains a foundation for building and learning about React apps. The site includes two routes showing how navigation works in a single page app. We manage the page head and body using a standard React flow. The homepage features a click effect that demonstrates using state, and an animation you can try out yourself by following the steps in `TODO.md`. 💫

[React](https://reactjs.org/) is a popular UI library for building web apps. [Vite](https://vitejs.dev/) is a powerful tool for building javascript apps that bundles all of your code and shows immediate changes while you're editing.

_While you're in the editor working, Glitch is running your `start` script in the background (`vite dev`). The site will be in dev mode and you'll see your changes happen ✨ immediately in the preview window. Once you close the editor window and your app goes to sleep, Glitch runs the `build` script and Vite builds your app for modern browsers._

_Last updated: 20 Mar 2023_

## Prerequisites

You'll get best use out of this project if you're familiar with basic JavaScript. This project is a static site, which means that the server builds the site from the content of the `src` folder while you're developing it, then it's able to serve the pages super quickly when the user requests them.

## What's in this project?

← `README.md`: That’s this file, where you can tell people what your cool website does and how you built it.

← `index.html`: This is the main page template React uses to build your site–it imports `index.jsx` to kick things off. When you're ready to share your site or add a custom domain, change SEO/meta settings in here.

← `src/`: This folder contains all the files React will use to build your site.

### Working in the `src/` folder 📁

React defines site components in [JSX](https://reactjs.org/docs/introducing-jsx.html), an extended version of JavaScript, so you'll see lots of `.jsx` files in the project.

← `src/index.jsx`: This is the root of your React app. The index script is imported in the site home template `index.html`. If you add libraries like [chakra-ui](https://chakra-ui.com) or [redux](https://react-redux.js.org), you'll insert their providers here. The `<HelmetProvider`> is an example of a provider you'd use.

← `src/app.jsx`: The base for defining your React app, this script imports the components that make up the site content. The `index.jsx` file imports the App script. The router (from [wouter](https://github.com/molefrog/wouter) 🐰) is also imported here.

← `src/styles`: CSS files add styling rules to your content. You have [a lot of](https://vitejs.dev/guide/features.html#css) importing options for CSS including CSS modules if that's your jam.

← `src/components/router.jsx`: One of the most important parts of a single page app is the router. It's how we know what page to show–the code maps the paths to the Home and About components. We're using [Wouter](https://github.com/molefrog/wouter), a tiny minimalist router. You could replace it for something like [React Router](https://reactrouter.com/).

← `src/components/seo.jsx`: When you share your site on social media, you'll want to make sure the meta tags are correct and that you've got an image. All of the settings for this file are in `src/seo.json`.

### Hooks 🪝

← `src/hooks/`: [Hooks](https://reactjs.org/docs/hooks-intro.html) are a powerful way to provide interaction with your app.

← `src/hooks/prefers-reduced-motion.jsx`: For accessibility reasons, some users will indicate in their system settings that they prefer motion effects to be minimized–this allows you to hold off on these effects in such cases.

← `src/hooks/wiggle.jsx`: The wiggle effect animates elements, as you'll see if you hover over the image (or text below it) on the homepage. You can apply the effect anywhere you like in the site as outlined in `TODO.md`.

### Pages 📃

← `src/pages/`: These files include components that specify the content of the Home and About pages. Each one is defined as a function and referenced in `router.jsx`. The content is built into the page outline specified in `app.jsx`.

← `src/pages/about.jsx`: The content of the About page, defined as a component function.

← `src/pages/home.jsx` The content of the Home page, also defined as a component function. The page includes the animated effect on hover, and title change effect on click (which is also a handy demo of using state data in React).

## Try this next 🏗️

Take a look in `TODO.md` for next steps you can try out in your new site!

**_Want a minimal version of this project to build your own React app? Check out [Blank React](https://glitch.com/edit/#!/remix/glitch-blank-react)!_**

![Glitch](https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576)

## You built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Want more details about React on Glitch? We've got a [Help Center article](https://help.glitch.com/kb/article/112) for you.
- Need more help? [Check out our Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
