import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { VideoReview } from './VideoReview';
import { StepNav } from '../StepNav';

export const dynamic = 'force-dynamic';

export default async function VideosReviewPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Allow this page in any post-Seedance state. 'complete' is allowed so
  // the user can re-review or re-trigger assembly from the step nav.
  const allowed = new Set([
    'videos-review',
    'generating',
    'assembling',
    'failed',
    'complete',
  ]);
  if (!allowed.has(project.status)) {
    redirect(`/projects/${project.id}`);
  }

  // If we don't have a video render for every scene yet, the picker
  // would just show empty cards -- send them back to the live status
  // page until Seedance finishes.
  const allRendered =
    project.scenes.length > 0 && project.scenes.every((s) => !!s.videoKey);
  if (!allRendered && project.status !== 'failed') {
    redirect(`/projects/${project.id}/status`);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-xs text-ink-100/60 hover:text-white transition mb-4 inline-block"
      >
        ← All projects
      </Link>
      <StepNav
        projectId={project.id}
        status={project.status}
        hasVideoRenders={allRendered}
      />
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-2 text-white animate-fade-up">
        Review the <span className="text-gradient">scene videos</span>
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1">
        Each scene was animated by Seedance. Preview them, regenerate any you
        don&rsquo;t like, then assemble the final cut.
      </p>
      <VideoReview initialProject={project} />
    </div>
  );
}
