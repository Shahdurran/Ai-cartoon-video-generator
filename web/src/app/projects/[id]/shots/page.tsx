import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ShotsReview } from './ShotsReview';
import { StepNav } from '../StepNav';

export const dynamic = 'force-dynamic';

export default async function ShotsReviewPage({
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

  // The shots step only makes sense once images have been generated.
  // Pre-image states still belong on /script or /; complete projects can
  // still revisit this page for reference.
  const allowedStates = new Set([
    'images-review',
    'images-ready',
    'shots-review',
    'shot-images-pending',
    'shot-images-review',
    'videos-review',
    'generating',
    'assembling',
    'complete',
    'failed',
  ]);
  if (!allowedStates.has(project.status)) {
    redirect(`/projects/${project.id}/script`);
  }

  const scenes = project.scenes ?? [];
  const hasVideoRenders =
    scenes.length > 0 &&
    scenes.every((s) =>
      s.multiShotEnabled
        ? (s.shots ?? []).length > 0 &&
          (s.shots ?? []).every((sh) => !!sh.videoKey)
        : !!s.videoKey
    );

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
        hasVideoRenders={hasVideoRenders}
      />
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-2 text-white animate-fade-up">
        Make it <span className="text-gradient">cinematic</span>
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1 max-w-3xl">
        By default each scene is a single Seedance clip — that can feel like
        a slideshow. Toggle multi-shot on the scenes you want to break up
        and we&rsquo;ll cross-cut between {project.multiShotTargetSeconds || 2.5}s
        cinematic shots of the same moment. The voiceover plays continuously
        across the cuts.
      </p>
      <ShotsReview initialProject={project} />
    </div>
  );
}
