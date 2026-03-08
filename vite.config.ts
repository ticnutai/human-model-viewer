import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const normalizePath = (id: string) => id.split("\\").join("/");

const manualChunks = (id: string) => {
  const normalizedId = normalizePath(id);

  if (normalizedId.includes("node_modules")) {
    if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) {
      return "vendor-react";
    }
    if (/[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/.test(id)) {
      return "vendor-query";
    }
    if (/[\\/]node_modules[\\/]@supabase[\\/]supabase-js[\\/]/.test(id)) {
      return "vendor-supabase";
    }
    if (/[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/.test(id)) {
      return "vendor-r3f";
    }
    if (/[\\/]node_modules[\\/]@react-three[\\/]drei[\\/]/.test(id)) {
      return "vendor-drei";
    }
    if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) {
      if (normalizedId.includes("/src/renderers/")) return "vendor-three-renderers";
      if (normalizedId.includes("/src/math/")) return "vendor-three-math";
      return normalizedId.includes("/examples/jsm/") ? "vendor-three-extras" : "vendor-three-core";
    }
    if (/[\\/]node_modules[\\/](@react-three[\\/]postprocessing|postprocessing|gsap)[\\/]/.test(id)) {
      return "vendor-three-effects";
    }
    if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) {
      return "vendor-ui";
    }
    return "vendor-misc";
  }

  if (normalizedId.includes("/src/components/ModelViewer.tsx")) return "viewer-shell";
  if (normalizedId.includes("/src/components/ModelManager/")) return "viewer-model-manager";
  if (normalizedId.includes("/src/components/InteractiveOrgans.tsx") || normalizedId.includes("/src/components/OrganDialog.tsx") || normalizedId.includes("/src/components/OrganData.ts")) return "viewer-organs";
  if (normalizedId.includes("/src/components/anatomy/")) return "viewer-effects";
  if (normalizedId.includes("/src/components/AnatomySourcesPanel.tsx") || normalizedId.includes("/src/components/DevPanel.tsx") || normalizedId.includes("/src/components/GlbAnalyzerPanel.tsx") || normalizedId.includes("/src/components/QuizPanel.tsx") || normalizedId.includes("/src/components/SqlHighlighter.tsx")) return "viewer-panels";
  if (normalizedId.includes("/src/pages/")) return "app-pages";

  return undefined;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 7000,
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 7000,
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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
