import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css';
import './styles/tokens.css';
import { App } from './App';
import { createMemoryKv, createStorage, type KeyValueStore } from './storage/storage';

/** 시크릿 모드·저장 차단 환경에서는 localStorage 접근 자체가 실패할 수 있다 */
function browserKv(): KeyValueStore | null {
  try {
    const ls = window.localStorage;
    const probe = 'crew-prototype/probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

const kv = browserKv();
// 저장소를 쓸 수 없으면 이 탭 안에서만 기록을 유지하고 경고를 띄운다
const storage = createStorage(kv ?? createMemoryKv());
const volatileWarning = kv
  ? null
  : '이 브라우저에서는 기록을 저장할 수 없어요. 이 탭을 닫거나 새로고침하면 처음 예시로 돌아가요.';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App storage={storage} volatileWarning={volatileWarning} />
  </StrictMode>,
);
