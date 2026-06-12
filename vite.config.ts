import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for all assets to support deployment on subpaths like GitHub Pages

  test: {
    // This injects 'window', 'document', and other browser globals globally
    environment: 'jsdom', // or 'happy-dom'
  },

  // 1. Tell esbuild to leave your Class names alone during building
  esbuild: {
    keepNames: true, // Stops minification from breaking your constructors!
  },
  
  build: {
    // 2. Set Vite to use esbuild for standard minification
    minify: 'esbuild',
    
    // 3. Set the build compilation target to match modern JavaScript
    target: 'es2022', 
  }
});
