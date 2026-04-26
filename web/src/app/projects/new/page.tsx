import Link from 'next/link';
import { api } from '@/lib/api';
import { NewProjectForm } from './NewProjectForm';

export const dynamic = 'force-dynamic';

async function loadStyles() {
  const res = await api.listStyles().catch(() => ({ styles: [] }));
  return res.styles;
}

export default async function NewProjectPage() {
  const styles = await loadStyles();
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-xs text-ink-100/60 hover:text-white transition"
      >
        ← All projects
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight mt-3 mb-2 text-white animate-fade-up">
        New <span className="text-gradient">project</span>
      </h1>
      <p className="text-sm text-ink-100/70 mb-8 animate-fade-up stagger-1">
        Pick a topic and a style. We&rsquo;ll draft the script first — you
        can edit every scene before any images or video are generated.
      </p>
      <NewProjectForm styles={styles} />
    </div>
  );
}
