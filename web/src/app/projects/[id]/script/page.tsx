import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ScriptReview } from './ScriptReview';
import { StepNav } from '../StepNav';

export const dynamic = 'force-dynamic';

export default async function ScriptReviewPage({
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
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load project: {err.message}
        </div>
      </div>
    );
  }

  // We intentionally don't redirect post-script projects away from this
  // page anymore -- ScriptReview itself disables editing controls when
  // the project has progressed past 'script-review' so users can still
  // review the original script for reference via the step nav.

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
        Review the <span className="text-gradient">script</span>
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1">
        Edit any scene&rsquo;s narration or visual prompt, reorder, add, or
        remove scenes. Nothing is generated until you approve.
      </p>
      <ScriptReview initialProject={project} />
    </div>
  );
}
