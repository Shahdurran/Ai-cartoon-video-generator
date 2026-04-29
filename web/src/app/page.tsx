import Link from 'next/link';
import { api, type ProjectListItem } from '@/lib/api';
import { ProjectsList } from './ProjectsList';

export const dynamic = 'force-dynamic';

async function loadProjects(): Promise<ProjectListItem[]> {
  try {
    const { projects } = await api.listProjects();
    return projects;
  } catch (err) {
    console.error('listProjects failed', err);
    return [];
  }
}

export default async function HomePage() {
  const projects = await loadProjects();
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Your <span className="text-gradient">projects</span>
          </h1>
          <p className="text-sm text-ink-100/70 mt-2">
            Each project is a narrated AI cartoon video. Image generation
            runs in the background — feel free to open another project
            while one renders.
          </p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <span className="text-base">+</span> New project
        </Link>
      </div>

      <ProjectsList initialProjects={projects} />
    </div>
  );
}
