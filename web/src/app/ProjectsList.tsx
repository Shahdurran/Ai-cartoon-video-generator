'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ProjectListItem } from '@/lib/api';

type Props = { initialProjects: ProjectListItem[] };

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-white/10 text-ink-100',
  scripted: 'bg-violet-400/15 text-violet-200 border border-violet-400/30',
  'script-review':
    'bg-violet-400/15 text-violet-200 border border-violet-400/30',
  'images-pending':
    'bg-sky-400/15 text-sky-200 border border-sky-400/30 animate-glow',
  'images-review': 'bg-sky-400/15 text-sky-200 border border-sky-400/30',
  'images-ready':
    'bg-indigo-400/15 text-indigo-200 border border-indigo-400/30',
  generating:
    'bg-brand-400/15 text-brand-100 border border-brand-400/30 animate-glow',
  assembling:
    'bg-brand-400/15 text-brand-100 border border-brand-400/30 animate-glow',
  'videos-review':
    'bg-amber-400/15 text-amber-200 border border-amber-400/30',
  complete:
    'bg-emerald-400/15 text-emerald-200 border border-emerald-400/30',
  failed: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`pill ${STATUS_STYLE[status] || 'bg-white/10 text-ink-100'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

/**
 * Friendly human summary of where a project is in the pipeline.
 * Returns null when the project is in a terminal state where the badge
 * alone says enough (complete / draft).
 */
function progressLabel(p: ProjectListItem): string | null {
  const sp = p.sceneProgress;
  if (!sp || sp.total === 0) {
    return p.status === 'draft' ? 'Writing script…' : null;
  }
  switch (p.status) {
    case 'images-pending':
    case 'images-review':
    case 'images-ready':
      return `Generating images: ${sp.withImages}/${sp.total}${
        sp.failed > 0 ? ` · ${sp.failed} failed` : ''
      }`;
    case 'generating':
      return `Rendering scene videos: ${sp.withVideo}/${sp.total}${
        sp.failed > 0 ? ` · ${sp.failed} failed` : ''
      }`;
    case 'videos-review':
      return `Review ${sp.withVideo}/${sp.total} clips`;
    case 'assembling':
      return 'Stitching final cut…';
    case 'complete':
      return null;
    case 'failed':
      return p.errorMessage || `${sp.failed} scene${sp.failed === 1 ? '' : 's'} failed`;
    default:
      return null;
  }
}

/** Animated progress bar for in-flight states. */
function ProgressBar({ p }: { p: ProjectListItem }) {
  const sp = p.sceneProgress;
  if (!sp || sp.total === 0) return null;

  let value = 0;
  switch (p.status) {
    case 'images-pending':
    case 'images-review':
    case 'images-ready':
      value = sp.withImages / sp.total;
      break;
    case 'generating':
      value = sp.withVideo / sp.total;
      break;
    case 'videos-review':
      value = sp.withVideo / sp.total;
      break;
    case 'assembling':
      value = 0.95;
      break;
    case 'complete':
      return null;
    case 'failed':
      return null;
    default:
      return null;
  }

  return (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.max(2, Math.min(100, value * 100))}%`,
          backgroundImage:
            'linear-gradient(90deg, #FFA846 0%, #FF4689 100%)',
        }}
      />
    </div>
  );
}

const POLL_LIVE_MS = 4000;
const POLL_IDLE_MS = 30000;
const LIVE_STATES = new Set([
  'draft',
  'images-pending',
  'images-review',
  'generating',
  'assembling',
]);

export function ProjectsList({ initialProjects }: Props) {
  const [projects, setProjects] = useState(initialProjects);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const { projects: fresh } = await api.listProjects();
        if (!cancelled) setProjects(fresh);
      } catch {
        /* swallow; try again next interval */
      } finally {
        if (cancelled) return;
        const anyLive = (projects.length ? projects : initialProjects).some(
          (p) => LIVE_STATES.has(p.status)
        );
        timer = setTimeout(tick, anyLive ? POLL_LIVE_MS : POLL_IDLE_MS);
      }
    }

    timer = setTimeout(tick, POLL_LIVE_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  if (projects.length === 0) {
    return (
      <div className="glass rounded-3xl p-14 text-center animate-fade-up stagger-1">
        <div
          className="mx-auto mb-4 h-16 w-16 rounded-2xl animate-float"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
            boxShadow: '0 20px 40px -12px rgba(255, 70, 137, 0.5)',
          }}
        />
        <div className="text-xl font-medium text-white mb-2">
          No projects yet
        </div>
        <p className="text-sm text-ink-100/70 mb-6">
          Start by picking a style, a voice, and a topic.
        </p>
        <Link href="/projects/new" className="btn-primary">
          Create your first project
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {projects.map((p, i) => {
        const label = progressLabel(p);
        return (
          <li
            key={p.id}
            className="animate-fade-up"
            style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
          >
            <Link
              href={`/projects/${p.id}`}
              className="glass block rounded-2xl px-6 py-5 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">
                    {p.topic || 'Untitled'}
                  </div>
                  <div className="text-xs text-ink-100/60 mt-1">
                    {p.sceneCount} scenes ·{' '}
                    {new Date(p.createdAt).toLocaleString()}
                  </div>
                  {label && (
                    <div className="mt-2 text-[12px] text-ink-100/85">
                      {label}
                    </div>
                  )}
                  <ProgressBar p={p} />
                </div>
                <StatusPill status={p.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
