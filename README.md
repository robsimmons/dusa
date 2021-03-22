## Hello React!

[React](https://reactjs.org) is a popular UI library for building web apps, usually single page apps. 

While you're in the editor working, Glitch is running your `start` script in the background. We're using [snowpack](https://snowpack.dev) to run. While you develop your application, your changes will happen 🪄 immediately in the preview window, or if you've opened it in another tab. 

Once you close the window and your remix goes to sleep, Glitch runs the `build` script. We're using [snowpack](https://snowpack.dev) to optimize the final build.

### Files

← README.md: That’s this file, where you can tell people what your cool website does and how you built it.

← LICENSE: something about the MIT License

← src/App.jsx: Your React app!! You can see the language strings, and the click event to change it. 

← src/index.jsx: This is the root of your React app. If you add libraries like [chakra-ui](https://chakra-ui.com) or [redux](https://react-redux.js.org), you'll insert their providers here.

← src/index.css: CSS files add styling rules to your content.

← `build`: Your development bundle will be here while you're creating your app. When it goes to sleep, glitch will automatically run the `build` NPM command for a production build.