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

  useEffect(() => {
    // Always re-fetch on mount: the server snapshot used by Next.js may
    // pre-date the latest assembly (e.g. subtitlesKey was null when this
    // page was rendered but the SRT has since been uploaded). One eager
    // refresh lets us show the new captions banner state correctly.
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While we have voice but no subtitles yet on a complete project, the
  // assembly may still be uploading the SRT or the next /api/projects
  // poll just hasn't returned yet. Poll a few times so the warning banner
  // disappears on its own once subtitlesKey lands.
  useEffect(() => {
    const sceneHasVoice = project.scenes.some((s) => !!s.voiceKey);
    const needSubs =
      project.status === 'complete' && sceneHasVoice && !project.subtitlesKey;
    if (!needSubs) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.status, project.subtitlesKey]);

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
      <div className="glass rounded-2xl p-12 text-center animate-fade-up">
        <div className="text-sm text-ink-100/80">
          The final video isn&apos;t ready yet. If this page stays empty, the signed URL may have expired — try refreshing.
        </div>
      </div>
    );
  }

  // If the project has voiceovers but no subtitles, the most likely
  // cause is a missing/invalid ASSEMBLYAI_API_KEY -- surface that
  // visibly so the user doesn't think captions are silently broken.
  const sceneHasVoice = project.scenes.some((s) => !!s.voiceKey);
  const subtitlesMissing = sceneHasVoice && !project.subtitlesKey;

  return (
    <div className="space-y-10">
      {subtitlesMissing && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 animate-fade-in">
          <div className="font-medium mb-0.5">No subtitles were burned in</div>
          <div className="text-xs text-amber-200/80">
            The Node backend reads <code className="text-amber-100">ASSEMBLYAI_API_KEY</code> from the
            <strong className="text-amber-100"> repository root </strong>
            <code className="text-amber-100">.env</code> (same folder as <code className="text-amber-100">server-new.js</code>),
            not from <code className="text-amber-100">web/.env.local</code>. Get a key from{' '}
            <a href="https://www.assemblyai.com/app" target="_blank" rel="noreferrer" className="underline">assemblyai.com</a>,
            save, restart the backend, then use <span className="text-white">Scene videos</span> → re-assemble.
          </div>
        </div>
      )}
      <section className="animate-fade-up">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-glass-strong">
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
            className="btn-primary"
          >
            Download MP4
          </a>
          <button onClick={refresh} className="btn-ghost">
            Refresh URL
          </button>
        </div>
      </section>

      <section className="animate-fade-up stagger-1">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Hook <span className="text-gradient">variants</span>
            </h2>
            <p className="text-sm text-ink-100/70">
              Rewrite the opening into N different hooks spliced onto the front of the video.
            </p>
          </div>
        </div>

        <div className="glass-panel mb-6">
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="label">Hook duration (seconds)</span>
              <input
                type="number"
                min={5}
                max={30}
                value={hookDuration}
                onChange={(e) => setHookDuration(parseInt(e.target.value || '10', 10))}
                className="field mt-1.5"
              />
            </label>
            <label className="block">
              <span className="label">Number of variants</span>
              <input
                type="number"
                min={1}
                max={5}
                value={variantCount}
                onChange={(e) => setVariantCount(parseInt(e.target.value || '3', 10))}
                className="field mt-1.5"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={generateHooks}
                disabled={hookBusy}
                className="btn-primary w-full"
              >
                {hookBusy ? 'Queuing…' : 'Generate hooks'}
              </button>
            </div>
          </div>
          {hookError && (
            <div className="mt-3 text-sm text-rose-300">{hookError}</div>
          )}
        </div>

        {project.hookVariants.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-ink-100/70">
            No hook variants yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {project.hookVariants.map((h, i) => (
              <div
                key={h.id}
                className="glass rounded-2xl overflow-hidden flex flex-col animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                {h.outputSignedUrl ? (
                  <video
                    src={h.outputSignedUrl}
                    controls
                    className="w-full aspect-video bg-black"
                  />
                ) : (
                  <div className="w-full aspect-video shimmer flex items-center justify-center text-sm text-ink-100/70">
                    {h.status === 'failed' ? (
                      <span className="text-rose-300">
                        Failed: {h.errorMessage}
                      </span>
                    ) : (
                      'Generating…'
                    )}
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-[11px] uppercase tracking-wider text-brand-100/80 font-medium">
                    Variant {h.variantIndex + 1}
                  </div>
                  <p className="text-sm text-ink-50 mt-2 flex-1 leading-relaxed">
                    {h.hookScript}
                  </p>
                  {h.outputSignedUrl && (
                    <a
                      href={h.outputSignedUrl}
                      download={`${project.id}-hook-${h.variantIndex + 1}.mp4`}
                      className="btn-ghost mt-3 !px-3 !py-1.5 !text-xs self-start"
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
