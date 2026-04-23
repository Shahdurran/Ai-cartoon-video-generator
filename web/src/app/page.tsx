import Link from 'next/link';
import { api, type Project } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function loadProjects(): Promise<Project[]> {
  try {
    const { projects } = await api.listProjects();
    return projects;
  } catch (err) {
    console.error('listProjects failed', err);
    return [];
  }
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-white/10 text-ink-100',
  scripted: 'bg-violet-400/15 text-violet-200 border border-violet-400/30',
  'images-ready': 'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
  generating: 'bg-brand-400/15 text-brand-100 border border-brand-400/30 animate-glow',
  assembling: 'bg-brand-400/15 text-brand-100 border border-brand-400/30 animate-glow',
  complete: 'bg-emerald-400/15 text-emerald-200 border border-emerald-400/30',
  failed: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`pill ${STATUS_STYLE[status] || 'bg-white/10 text-ink-100'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

export default async function HomePage() {
  const projects = await loadProjects();
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Your <span className="text-gradient">projects</span>
          </h1>
          <p className="text-sm text-ink-100/70 mt-2">
            Each project is a narrated AI cartoon video.
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <span className="text-base">+</span> New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="glass rounded-3xl p-14 text-center animate-fade-up stagger-1">
          <div
            className="mx-auto mb-4 h-16 w-16 rounded-2xl animate-float"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
              boxShadow: '0 20px 40px -12px rgba(255, 70, 137, 0.5)',
            }}
          />
          <div className="text-xl font-medium text-white mb-2">
            No projects yet
          </div>
          <p className="text-sm text-ink-100/70 mb-6">
            Start by picking a style, a voice, and a topic.
          </p>
          <Link href="/projects/new" className="btn-primary">
            Create your first project
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4">
          {projects.map((p, i) => (
            <li
              key={p.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <Link
                href={`/projects/${p.id}`}
                className="glass block rounded-2xl px-6 py-5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">
                      {p.topic || 'Untitled'}
                    </div>
                    <div className="text-xs text-ink-100/60 mt-1">
                      {p.sceneCount} scenes ·{' '}
                      {new Date(p.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
