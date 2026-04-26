'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ProjectStatus } from '@/lib/api';

type Step = {
  key: 'script' | 'images' | 'videos' | 'final';
  label: string;
  href: (id: string) => string;
};

const STEPS: Step[] = [
  { key: 'script', label: 'Script', href: (id) => `/projects/${id}/script` },
  // ?stay=1 stops the project page's status-based redirect so the user
  // can actually land here once the project has moved past this step.
  { key: 'images', label: 'Images & settings', href: (id) => `/projects/${id}?stay=1` },
  { key: 'videos', label: 'Scene videos', href: (id) => `/projects/${id}/videos` },
  { key: 'final', label: 'Final cut', href: (id) => `/projects/${id}/final` },
];

/**
 * Map a project's status to which step is the furthest the user can have
 * reached. Used to disable forward steps that don't make sense yet.
 */
function maxReachableStep(status: ProjectStatus | string): Step['key'] {
  if (status === 'complete') return 'final';
  if (status === 'assembling') return 'final';
  if (status === 'videos-review' || status === 'generating' || status === 'failed') {
    return 'videos';
  }
  if (
    status === 'images-pending' ||
    status === 'images-review' ||
    status === 'images-ready'
  ) {
    return 'images';
  }
  return 'script';
}

const ORDER: Step['key'][] = ['script', 'images', 'videos', 'final'];

function isReachable(target: Step['key'], reached: Step['key']) {
  return ORDER.indexOf(target) <= ORDER.indexOf(reached);
}

function activeStepFromPath(path: string): Step['key'] | null {
  if (path.endsWith('/script')) return 'script';
  if (path.endsWith('/videos')) return 'videos';
  if (path.endsWith('/final')) return 'final';
  if (path.endsWith('/status')) return 'videos'; // status streams into videos-review
  // Bare /projects/[id] is the images & settings step.
  return 'images';
}

/**
 * Step breadcrumb shown at the top of every per-project page so the user
 * can jump back to an earlier stage without getting trapped on /final
 * once the project has assembled successfully.
 */
export function StepNav({
  projectId,
  status,
  hasVideoRenders,
}: {
  projectId: string;
  status: string;
  hasVideoRenders: boolean;
}) {
  const path = usePathname() || '';
  const active = activeStepFromPath(path);
  const reached = maxReachableStep(status);

  // If the user is on a 'complete' project, every prior step is reachable
  // for review. Same when they have all per-scene renders -- they can hop
  // back to the videos review page.
  const fullyOpen = status === 'complete' || hasVideoRenders;

  return (
    <nav
      aria-label="Project steps"
      className="mb-6 flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-[12px]"
    >
      {STEPS.map((step, i) => {
        const reachable = fullyOpen ? true : isReachable(step.key, reached);
        const isActive = step.key === active;
        const inner = (
          <span
            className={[
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition',
              isActive
                ? 'bg-white/10 text-white shadow-inner'
                : reachable
                  ? 'text-ink-100/80 hover:bg-white/[0.05] hover:text-white'
                  : 'text-ink-100/30 cursor-not-allowed',
            ].join(' ')}
            aria-current={isActive ? 'step' : undefined}
          >
            <span
              className={[
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium',
                isActive
                  ? 'bg-gradient-to-br from-[#FFA846] to-[#FF4689] text-white'
                  : reachable
                    ? 'bg-white/10 text-white/80'
                    : 'bg-white/5 text-white/30',
              ].join(' ')}
            >
              {i + 1}
            </span>
            {step.label}
          </span>
        );
        return (
          <div key={step.key} className="contents">
            {reachable && !isActive ? (
              <Link href={step.href(projectId)}>{inner}</Link>
            ) : (
              inner
            )}
            {i < STEPS.length - 1 && (
              <span className="text-ink-100/30 px-0.5" aria-hidden>
                ›
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
