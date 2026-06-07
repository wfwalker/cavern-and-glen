import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for all assets to support deployment on subpaths like GitHub Pages

  test: {
    // This injects 'window', 'document', and other browser globals globally
    environment: 'jsdom', // or 'happy-dom'
  },
});
