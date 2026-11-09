/**
 * 하나의 저장 어댑터 (명세 11.1).
 * 이 앱의 키만 읽고 쓴다. 다른 앱의 저장소를 지우지 않는다.
 * 호환되지 않는 저장 버전은 자동 삭제하지 않는다.
 */
import type { AppData, ID } from '../domain/types';

/** 데이터 저장 형식 버전. 문서 버전(v0.3)과 별개다. */
export const SCHEMA_VERSION = 1;

export const DATA_KEY = 'crew-prototype/data';
export const SESSION_KEY = 'crew-prototype/session';

interface StoredData {
  schemaVersion: number;
  savedAt: string;
  data: AppData;
}

export interface SessionPrefs {
  currentUserId: ID;
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; data: AppData }
  | { kind: 'incompatible'; foundVersion: unknown }
  | { kind: 'unreadable' };

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Storage {
  load(): LoadResult;
  /** 실패하면 예외를 던진다. 호출한 쪽은 화면 상태를 확정하지 않는다. */
  save(data: AppData): void;
  loadSession(): SessionPrefs | null;
  saveSession(prefs: SessionPrefs): void;
}

function isAppData(v: unknown): v is AppData {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.seededAt === 'string' &&
    typeof d.seq === 'number' &&
    ['users', 'crews', 'missions', 'deliverables', 'versions', 'feedbacks', 'notifications'].every((k) =>
      Array.isArray(d[k]),
    )
  );
}

export function createStorage(kv: KeyValueStore): Storage {
  return {
    load() {
      let raw: string | null;
      try {
        raw = kv.getItem(DATA_KEY);
      } catch {
        return { kind: 'unreadable' };
      }
      if (raw === null) return { kind: 'empty' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { kind: 'unreadable' };
      }
      const stored = parsed as Partial<StoredData>;
      if (!stored || stored.schemaVersion !== SCHEMA_VERSION) {
        return { kind: 'incompatible', foundVersion: stored?.schemaVersion };
      }
      if (!isAppData(stored.data)) return { kind: 'unreadable' };
      return { kind: 'ok', data: stored.data };
    },
    save(data) {
      const stored: StoredData = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
      kv.setItem(DATA_KEY, JSON.stringify(stored));
    },
    loadSession() {
      try {
        const raw = kv.getItem(SESSION_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<SessionPrefs>;
        return typeof v.currentUserId === 'string' ? { currentUserId: v.currentUserId } : null;
      } catch {
        return null;
      }
    },
    saveSession(prefs) {
      try {
        kv.setItem(SESSION_KEY, JSON.stringify(prefs));
      } catch {
        // 예시 사용자 선택은 업무 기록이 아니다. 저장하지 못해도 화면은 계속 쓴다.
      }
    },
  };
}

/** 메모리 저장소 (테스트용). failWrites 로 저장 실패를 흉내 낸다. */
export function createMemoryKv(): KeyValueStore & { failWrites: boolean; dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    failWrites: false,
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      if (this.failWrites) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}
