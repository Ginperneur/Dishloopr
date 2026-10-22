import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GA measurement IDs are public identifiers; expose only this named setting.
  define: {
    'import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID': JSON.stringify(process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID ?? ''),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: mode === "production"
    ? { drop: ["console", "debugger"], pure: ["console.log", "console.warn", "console.error", "console.info"] }
    : undefined,
}));
