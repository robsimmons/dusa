module.exports = {
  mount: {
    public: { url: "/", static: true },
    src: { url: "/dist" }
  },
  plugins: ['@snowpack/plugin-react-refresh'],
  routes: [],
  optimize: {
    bundle: true
  },
  packageOptions: {
  },
  devOptions: {
    hmrPort: 3000
  },
  buildOptions: {
  }
};
