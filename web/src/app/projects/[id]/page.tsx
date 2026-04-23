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
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
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
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← All projects
        </Link>
      </div>
      <ProjectDetail
        initialProject={project}
        voices={voicesRes.status === 'fulfilled' ? voicesRes.value.voices : []}
        tracks={musicRes.status === 'fulfilled' ? musicRes.value.tracks : []}
      />
    </div>
  );
}
