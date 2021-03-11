module.exports = {
  mount: {
    public: { url: "/", static: true },
    src: { url: "/dist" }
  },
  plugins: ["@snowpack/plugin-react-refresh"],
  routes: [],
  optimize: {
    bundle: true
  },
  packageOptions: {
    source: 'remote'
  },
  devOptions: {
  },
  buildOptions: {
  }
};
