'use client';

import { useEffect, useState } from 'react';
import { api, type Project } from '@/lib/api';

export function FinalVideo({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState(initialProject);
  const [hookDuration, setHookDuration] = useState(10);
  const [variantCount, setVariantCount] = useState(3);
  const [hookBusy, setHookBusy] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);

  async function refresh() {
    try {
      const { project: fresh } = await api.getProject(project.id);
      setProject(fresh);
    } catch (_) { /* ignore */ }
  }

  // If we were redirected here but the signed URL is stale, refetch.
  useEffect(() => {
    if (project.status === 'complete' && !project.outputSignedUrl) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while hooks are being generated.
  useEffect(() => {
    const incomplete = project.hookVariants.filter((h) => h.status === 'pending');
    if (incomplete.length === 0) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.hookVariants.map((h) => `${h.id}:${h.status}`).join(',')]);

  async function generateHooks() {
    setHookBusy(true);
    setHookError(null);
    try {
      await api.generateHooks(project.id, {
        hookDurationSeconds: hookDuration,
        variantCount,
      });
      await refresh();
    } catch (err: any) {
      setHookError(err.message);
    } finally {
      setHookBusy(false);
    }
  }

  if (!project.outputSignedUrl) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
        <div className="text-sm text-slate-600">
          The final video isn&apos;t ready yet. If this page stays empty, the signed URL may have expired — try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="rounded-xl border border-slate-200 bg-black overflow-hidden">
          <video
            src={project.outputSignedUrl}
            controls
            className="w-full max-h-[70vh] bg-black"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <a
            href={project.outputSignedUrl}
            download={`${project.id}.mp4`}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            Download MP4
          </a>
          <button
            onClick={refresh}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Refresh URL
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Hook variants</h2>
            <p className="text-sm text-slate-500">
              Rewrite the opening into N different hooks spliced onto the front of the video.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs text-slate-600">Hook duration (seconds)</span>
              <input
                type="number"
                min={5}
                max={30}
                value={hookDuration}
                onChange={(e) => setHookDuration(parseInt(e.target.value || '10', 10))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Number of variants</span>
              <input
                type="number"
                min={1}
                max={5}
                value={variantCount}
                onChange={(e) => setVariantCount(parseInt(e.target.value || '3', 10))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={generateHooks}
                disabled={hookBusy}
                className="w-full rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {hookBusy ? 'Queuing…' : 'Generate hooks'}
              </button>
            </div>
          </div>
          {hookError && (
            <div className="mt-3 text-sm text-rose-600">{hookError}</div>
          )}
        </div>

        {project.hookVariants.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No hook variants yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {project.hookVariants.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
              >
                {h.outputSignedUrl ? (
                  <video
                    src={h.outputSignedUrl}
                    controls
                    className="w-full aspect-video bg-black"
                  />
                ) : (
                  <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-sm text-slate-500">
                    {h.status === 'failed' ? `Failed: ${h.errorMessage}` : 'Generating…'}
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Variant {h.variantIndex + 1}
                  </div>
                  <p className="text-sm text-slate-700 mt-2 flex-1">{h.hookScript}</p>
                  {h.outputSignedUrl && (
                    <a
                      href={h.outputSignedUrl}
                      download={`${project.id}-hook-${h.variantIndex + 1}.mp4`}
                      className="mt-3 inline-block rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 self-start"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
