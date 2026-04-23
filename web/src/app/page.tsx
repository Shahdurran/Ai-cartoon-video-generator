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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    scripted: 'bg-indigo-100 text-indigo-700',
    'images-ready': 'bg-violet-100 text-violet-700',
    generating: 'bg-amber-100 text-amber-700',
    assembling: 'bg-amber-100 text-amber-700',
    complete: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

export default async function HomePage() {
  const projects = await loadProjects();
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-600 mt-1">
            Each project is a narrated AI cartoon video.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-brand-700"
        >
          + New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <div className="text-lg font-medium mb-2">No projects yet</div>
          <p className="text-sm text-slate-600 mb-6">
            Start by picking a style and providing a topic.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-brand-400 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.topic || 'Untitled'}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {p.sceneCount} scenes · {new Date(p.createdAt).toLocaleString()}
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
