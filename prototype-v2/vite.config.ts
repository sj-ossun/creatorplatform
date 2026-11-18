import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 프로토타입 버전 2 (디자인 시스템 v0.7). 버전 1(저장소 루트 src)과 따로 빌드한다.
// 명령은 저장소 루트에서 실행한다 (package.json 의 *:v2 스크립트).
export default defineConfig({
  root: 'prototype-v2',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
