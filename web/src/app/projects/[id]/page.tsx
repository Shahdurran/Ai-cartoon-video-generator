import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProjectDetail } from './ProjectDetail';
import { StepNav } from './StepNav';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { stay?: string };
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

  // ?stay=1 lets the user land on this page even if status would normally
  // route them elsewhere. Used by the StepNav links so users can revisit
  // the images & settings step from a completed/in-flight project.
  const stay = searchParams?.stay === '1';

  // Pre-image states belong on the script-review page; the image picker
  // only makes sense once at least one scene image job has been queued.
  if (!stay) {
    const scriptStates = new Set(['draft', 'scripted', 'script-review']);
    if (scriptStates.has(project.status)) {
      redirect(`/projects/${project.id}/script`);
    }

    if (project.status === 'videos-review') {
      redirect(`/projects/${project.id}/videos`);
    }

    if (
      project.status === 'failed' &&
      project.scenes.length > 0 &&
      project.scenes.every((s) => !!s.videoKey)
    ) {
      redirect(`/projects/${project.id}/videos`);
    }

    const pipelineStates = new Set(['generating', 'assembling']);
    if (pipelineStates.has(project.status)) {
      redirect(`/projects/${project.id}/status`);
    }

    if (project.status === 'complete' && project.outputKey) {
      redirect(`/projects/${project.id}/final`);
    }
  }

  const [voicesRes, musicRes] = await Promise.allSettled([
    api.listVoices(),
    api.listMusic(),
  ]);

  const hasVideoRenders =
    project.scenes.length > 0 && project.scenes.every((s) => !!s.videoKey);

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
      <ProjectDetail
        initialProject={project}
        voices={voicesRes.status === 'fulfilled' ? voicesRes.value.voices : []}
        tracks={musicRes.status === 'fulfilled' ? musicRes.value.tracks : []}
      />
    </div>
  );
}
