import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Cartoon Generator',
  description: 'Turn a topic into a narrated cartoon video.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="blob-mid" aria-hidden />

          <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink-800/40 border-b border-white/10">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 group">
                <span
                  className="h-8 w-8 rounded-xl shadow-lg transition-transform group-hover:scale-105"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
                    boxShadow:
                      '0 8px 20px -8px rgba(255, 70, 137, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  }}
                  aria-hidden
                />
                <span className="font-semibold tracking-tight">
                  <span className="text-gradient">AI</span>{' '}
                  <span className="text-white">Cartoon Generator</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-lg text-ink-100/80 hover:text-white hover:bg-white/5 transition"
                >
                  Projects
                </Link>
                <Link
                  href="/projects/new"
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  + New project
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1 animate-fade-in">{children}</main>

          <footer className="border-t border-white/10 text-[11px] text-ink-200/60 backdrop-blur-md bg-ink-800/30">
            <div className="max-w-6xl mx-auto px-6 py-4">
              Internal tool. Powered by Claude, Flux, Seedance, ElevenLabs, AssemblyAI.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
