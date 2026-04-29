import { ScenesDrawerLauncher } from './ScenesDrawerLauncher';

/**
 * Per-project layout: every step page (`/script`, `/`, `/videos`, `/final`,
 * `/status`) inherits the global Scenes drawer launcher so the user can
 * tweak any scene's voiceover, image prompt, image, or product reference
 * without leaving the current step.
 *
 * The drawer itself is lazy-mounted by the launcher when the user opens it,
 * keeping the per-step pages light.
 */
export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <>
      {children}
      <ScenesDrawerLauncher projectId={params.id} />
    </>
  );
}
