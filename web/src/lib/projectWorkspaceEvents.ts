/**
 * When the floating Scenes drawer mutates project data, step pages that
 * keep their own `useState(initialProject)` copy can listen for this event
 * and re-fetch so the main view matches without a full reload.
 */
export const PROJECT_WORKSPACE_MUTATED = 'project-workspace-mutated';

export type ProjectWorkspaceMutatedDetail = { projectId: string };

export function notifyProjectWorkspaceMutated(projectId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ProjectWorkspaceMutatedDetail>(PROJECT_WORKSPACE_MUTATED, {
      detail: { projectId },
    })
  );
}
