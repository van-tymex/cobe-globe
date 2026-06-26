import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    outDir: "ios-prototype/CobeGlobePrototype/CobeGlobePrototype/GlobeWeb/assets",
    emptyOutDir: false,
    cssCodeSplit: true,
    lib: {
      entry: "src/ios-globe.ts",
      name: "CobeIOSGlobe",
      formats: ["iife"],
      fileName: () => "ios-globe.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "ios-globe.css",
      },
    },
  },
});
