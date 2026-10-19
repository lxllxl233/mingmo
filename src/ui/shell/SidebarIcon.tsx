const GLYPHS: Record<string, string> = {
  focus: 'M5 3h8v2H7v10h8V8h2v9H5zM11 3l3 1-1 3-2-1z',
  core: 'M9 2l2.1 4.3L16 7l-3.5 3.4.8 4.8L9 12.9 4.7 15.2l.8-4.8L2 7l4.9-.7z',
  research: 'M7 2h4v4l3 7a2 2 0 0 1-1.8 3H5.8A2 2 0 0 1 4 13l3-7zM7 4h4',
  estates: 'M9 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3 16c0-3 2.7-5 6-5s6 2 6 5M1 9c1.5 0 2.5 1 2.5 2.4M17 9c-1.5 0-2.5 1-2.5 2.4',
  budget: 'M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zM6 9h6M9 6v6',
  military: 'M4 15L14 4M12 3l3 3M3 12l3 3M4 16l3-1-2-2z',
  diplomacy: 'M4 16V3M5 3h8l-2 3 2 3H5',
  court: 'M9 2l2 3h3l-1 4 3 2-3 2 1 4h-3l-2 3-2-3H4l1-4-3-2 3-2-1-4h3z',
  banner: 'M4 15V3h8l-2 3 2 3H4M4 15h7',
  confiscation: 'M3 6h10v8H3zM5 6V4h6v2M6 9h4',
  legitimacy: 'M9 2l1.5 4H15l-3.5 2.5L13 13 9 10.5 5 13l1.5-4.5L3 6h4.5z',
  trade: 'M2 13h14l-2 3H4zM4 13l2-6h6l2 6M7 7V4h4v3',
  league: 'M2 14l4-9 3 5 3-7 4 11z',
  decisions: 'M3 15h7M6 15V6l4-2 4 2v9M8 8h4M8 11h4',
  log: 'M4 2h9v14H4zM6 5h5M6 8h5M6 11h5',
};

export function SidebarIcon({ kind }: { kind: string }) {
  return (
    <svg className="sidebar-icon" viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
      <path d={GLYPHS[kind] ?? GLYPHS.focus} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

