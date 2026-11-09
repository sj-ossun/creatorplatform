/** 아이콘은 다섯 개뿐이다 (디자인 6.20). 14px, currentColor. */
export type IconName = 'lock' | 'external' | 'bell' | 'clock' | 'check';

const PATHS: Record<IconName, JSX.Element> = {
  lock: (
    <>
      <rect x="3" y="6.5" width="8" height="6" rx="1.2" />
      <path d="M5 6.5V4.8a2 2 0 0 1 4 0v1.7" />
    </>
  ),
  external: (
    <>
      <path d="M8.5 2.5h3v3" />
      <path d="M11.5 2.5 6.5 7.5" />
      <path d="M10 8.5v2.3a.7.7 0 0 1-.7.7H3.2a.7.7 0 0 1-.7-.7V4.7a.7.7 0 0 1 .7-.7h2.3" />
    </>
  ),
  bell: (
    <>
      <path d="M3.5 9.5V6.3a3.5 3.5 0 0 1 7 0v3.2l1 1.2h-9z" />
      <path d="M5.8 12.2a1.3 1.3 0 0 0 2.4 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4.3V7l1.8 1.3" />
    </>
  ),
  check: <path d="m3 7.3 2.6 2.5L11 4.4" />,
};

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{ flex: 'none' }}
    >
      {PATHS[name]}
    </svg>
  );
}
