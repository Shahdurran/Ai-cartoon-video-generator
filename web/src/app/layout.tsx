import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Cartoon Generator',
  description: 'Turn a topic into a narrated cartoon video.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
              <a href="/" className="font-semibold text-lg tracking-tight">
                <span className="text-brand-600">AI</span> Cartoon Generator
              </a>
              <nav className="flex items-center gap-6 text-sm">
                <a href="/" className="text-slate-600 hover:text-slate-900">Projects</a>
                <a href="/projects/new" className="text-slate-600 hover:text-slate-900">New</a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white text-xs text-slate-500">
            <div className="max-w-6xl mx-auto px-6 py-4">
              Internal tool. Powered by Claude, Flux, Seedance, ElevenLabs, AssemblyAI.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
