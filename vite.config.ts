import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: false,
  },
  plugins: [
    react(),
    mode === "development" && process.env.LOVABLE_TAGGER === "true" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
            "@radix-ui/react-label",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
          ],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
