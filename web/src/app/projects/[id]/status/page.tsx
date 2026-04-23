import { StatusStream } from './StatusStream';
import { api } from '@/lib/api';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StatusPage({ params }: { params: { id: string } }) {
  const { project } = await api.getProject(params.id);
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href={`/projects/${project.id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to project
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Generating: {project.topic || 'Untitled'}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        This page streams real-time updates and will redirect to the final video when ready.
      </p>
      <StatusStream project={project} />
    </div>
  );
}
