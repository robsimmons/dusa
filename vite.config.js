import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    outDir: "build"
  },
  server: {
    hmr: {
      protocol: 'wss',
      port: 3000
    }
  }
});
