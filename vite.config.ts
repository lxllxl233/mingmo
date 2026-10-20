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
          // 内容数据按体积拆分，避免单个 chunk 超过 500KB（pixi 除外）。
          if (id.includes('/src/content/data/')) {
            if (id.includes('/src/content/data/map/provinces.geo.json')) return 'map-geo';
            if (id.includes('/src/content/data/events/')) return 'content-events';
            if (id.includes('/src/content/data/map/')) return 'content-map';
            return 'content-data';
          }
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
      ignored: ['**/*.tmpdir/**', '**/.*.tmpdir/**', '**/.esbuild-tmp/**', '**/dist/**', '**/out/**', '**/*.v8.log', '**/isolate-*.log'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
