import Link from 'next/link';
import { api } from '@/lib/api';
import { FinalVideo } from './FinalVideo';
import { StepNav } from '../StepNav';

export const dynamic = 'force-dynamic';

export default async function FinalPage({ params }: { params: { id: string } }) {
  const { project } = await api.getProject(params.id);
  const hasVideoRenders =
    project.scenes.length > 0 && project.scenes.every((s) => !!s.videoKey);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-xs text-ink-100/60 hover:text-white transition mb-4 inline-block"
      >
        ← All projects
      </Link>
      <StepNav
        projectId={project.id}
        status={project.status}
        hasVideoRenders={hasVideoRenders}
      />
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-2 text-white animate-fade-up">
        {project.topic || 'Untitled'}
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1">
        Status: <span className="font-medium text-white">{project.status}</span>
      </p>
      <FinalVideo initialProject={project} />
    </div>
  );
}
