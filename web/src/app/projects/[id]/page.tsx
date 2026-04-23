import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProjectDetail } from './ProjectDetail';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  let project;
  try {
    ({ project } = await api.getProject(params.id));
  } catch (err: any) {
    if (err.message?.includes('404') || err.message?.includes('not found')) {
      notFound();
    }
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load project: {err.message}
        </div>
      </div>
    );
  }

  const [voicesRes, musicRes] = await Promise.allSettled([
    api.listVoices(),
    api.listMusic(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-xs text-ink-100/60 hover:text-white transition mb-6 inline-block"
      >
        ← All projects
      </Link>
      <ProjectDetail
        initialProject={project}
        voices={voicesRes.status === 'fulfilled' ? voicesRes.value.voices : []}
        tracks={musicRes.status === 'fulfilled' ? musicRes.value.tracks : []}
      />
    </div>
  );
}
