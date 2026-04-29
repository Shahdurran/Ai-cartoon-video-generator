'use client';

import { useEffect, useState } from 'react';
import { ScenesDrawer } from './ScenesDrawer';

/**
 * Small fixed launcher button in the bottom-right of every project page.
 * Lazily mounts the (heavier) drawer the first time the user opens it,
 * keeping the per-step pages light.
 */
export function ScenesDrawerLauncher({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Keyboard shortcut: `S` toggles the drawer. Skip when the user is
  // typing into a form so we don't hijack the letter.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
        setHasOpened(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setHasOpened(true);
        }}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/15 bg-ink-800/85 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md transition hover:border-white/30 hover:bg-ink-700/90"
        title="Open scenes panel (press S)"
        aria-label="Open scenes panel"
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
          }}
        />
        Scenes
        <kbd className="ml-1 rounded border border-white/20 bg-white/10 px-1.5 text-[10px] text-white/70">
          S
        </kbd>
      </button>
      {hasOpened && (
        <ScenesDrawer
          projectId={projectId}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
