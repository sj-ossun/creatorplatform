/**
 * 설치 없이 링크로 열어 보는 단일 HTML 빌드.
 * JS·CSS·글꼴을 한 파일에 넣는다 (외부 파일·CDN 없이 동작).
 * 실행: npm run build:artifact  →  dist-artifact/crew-prototype.html
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist-artifact';
await build({
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // 글꼴을 CSS 안에 data URI 로 넣는다
    cssCodeSplit: false,
    modulePreload: false,
  },
});

const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

// 인라인 스크립트 안의 </script 가 태그를 닫지 않게
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const html = `<title>CREW 프로토타입</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;
const target = join(outDir, 'crew-prototype.html');
writeFileSync(target, html);
console.log(`${target}  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
