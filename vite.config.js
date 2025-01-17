import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/my-new-app/', // Projenizin GitHub reposu adıyla aynı olmalı
});
