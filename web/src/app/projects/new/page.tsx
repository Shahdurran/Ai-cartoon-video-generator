import Link from 'next/link';
import { api } from '@/lib/api';
import { NewProjectForm } from './NewProjectForm';

export const dynamic = 'force-dynamic';

async function loadBootstrap() {
  const [stylesRes, musicRes, voicesRes] = await Promise.allSettled([
    api.listStyles(),
    api.listMusic(),
    api.listVoices(),
  ]);
  return {
    styles: stylesRes.status === 'fulfilled' ? stylesRes.value.styles : [],
    tracks: musicRes.status === 'fulfilled' ? musicRes.value.tracks : [],
    voices: voicesRes.status === 'fulfilled' ? voicesRes.value.voices : [],
    voicesError:
      voicesRes.status === 'rejected' ? voicesRes.reason.message : null,
  };
}

export default async function NewProjectPage() {
  const bootstrap = await loadBootstrap();
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-xs text-ink-100/60 hover:text-white transition"
      >
        ← All projects
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-8 text-white animate-fade-up">
        New <span className="text-gradient">project</span>
      </h1>
      <NewProjectForm {...bootstrap} />
    </div>
  );
}
