import type { ProjectStatus } from '@/lib/api';

/**
 * Statuses where narration, image prompt, duration, product reference, and
 * per-scene image actions are allowed. Matches the Script step and should be
 * used anywhere the global Scenes drawer edits the same fields.
 */
const SCENE_EDITOR_UNLOCKED = new Set<ProjectStatus>([
  'draft',
  'scripted',
  'script-review',
  'images-pending',
  'images-review',
  'images-ready',
]);

export function isSceneContentEditable(status: ProjectStatus | string): boolean {
  return SCENE_EDITOR_UNLOCKED.has(status as ProjectStatus);
}
