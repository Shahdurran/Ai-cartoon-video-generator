import { StatusStream } from './StatusStream';
import { api } from '@/lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StatusPage({ params }: { params: { id: string } }) {
  const { project } = await api.getProject(params.id);
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href={`/projects/${project.id}`}
        className="text-xs text-ink-100/60 hover:text-white transition"
      >
        ← Back to project
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-2 text-white animate-fade-up">
        Generating: <span className="text-gradient">{project.topic || 'Untitled'}</span>
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1">
        This page streams real-time updates and will redirect to the final video when ready.
      </p>
      <StatusStream project={project} />
    </div>
  );
}
