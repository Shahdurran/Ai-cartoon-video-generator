import Link from 'next/link';
import { api } from '@/lib/api';
import { FinalVideo } from './FinalVideo';

export const dynamic = 'force-dynamic';

export default async function FinalPage({ params }: { params: { id: string } }) {
  const { project } = await api.getProject(params.id);
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href={`/projects/${project.id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to project
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        {project.topic || 'Untitled'}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Status: <span className="font-medium text-slate-700">{project.status}</span>
      </p>
      <FinalVideo initialProject={project} />
    </div>
  );
}
