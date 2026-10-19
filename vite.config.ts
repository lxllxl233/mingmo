import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Windows + 沙箱环境下 esbuild 清理系统临时文件会被拒绝；把临时目录固定在工作区。
const esbuildTmp = join(process.cwd(), '.esbuild-tmp');
mkdirSync(esbuildTmp, { recursive: true });
process.env.TMP = esbuildTmp;
process.env.TEMP = esbuildTmp;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/content/')) return 'content';
          if (id.includes('node_modules/pixi.js')) return 'pixi';
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules/zustand')) return 'zustand';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/*.tmpdir/**', '**/.*.tmpdir/**', '**/.esbuild-tmp/**', '**/dist/**'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
