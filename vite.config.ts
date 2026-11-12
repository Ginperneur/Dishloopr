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
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they survive app deploys in the browser cache.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
  },
  esbuild: mode === "production"
    ? { drop: ["console", "debugger"], pure: ["console.log", "console.warn", "console.error", "console.info"] }
    : undefined,
}));
