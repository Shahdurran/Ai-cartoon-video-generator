import { ScenesDrawerLauncher } from './ScenesDrawerLauncher';

/**
 * Per-project layout: every step page (`/script`, `/`, `/videos`, `/final`,
 * `/status`) gets the floating **Scenes** launcher — the same narration, visual
 * prompt, product reference, and image actions as the Script step, without
 * leaving the page you are on.
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
