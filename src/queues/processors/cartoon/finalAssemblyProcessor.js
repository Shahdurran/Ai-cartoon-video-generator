/**
 * Final assembly processor. Downloads scene clips + subtitles + music from
 * R2, runs FFmpeg concat + color grade + subtitle burn + music mix, uploads
 * the final MP4 back to R2.
 *
 * Job data: { projectId }
 */

const assembler = require('../../../services/cartoonAssemblerService');
const sceneRepo = require('../../../db/repositories/sceneRepo');
const projectRepo = require('../../../db/repositories/projectRepo');
const styleRepo = require('../../../db/repositories/styleRepo');
const musicTrackRepo = require('../../../db/repositories/musicTrackRepo');
const r2Service = require('../../../services/r2Service');
const pubsub = require('../../../services/pubsubService');

module.exports = async function finalAssemblyProcessor(job) {
  const { projectId } = job.data;
  if (!projectId) throw new Error('projectId required');

  await pubsub.publish(projectId, { phase: 'assembly', status: 'running' });

  try {
    const project = await projectRepo.findById(projectId);
    if (!project) throw new Error('Project not found');

    const scenes = await sceneRepo.findByProject(projectId);
    const missing = scenes.filter((s) => !s.videoKey);
    if (missing.length > 0) {
      throw new Error(`${missing.length} scene(s) still missing videoKey`);
    }

    const style = project.styleId ? await styleRepo.findById(project.styleId) : null;
    const music = project.musicTrackId
      ? await musicTrackRepo.findById(project.musicTrackId)
      : null;

    const outputKey = r2Service.keys.finalVideo(projectId);

    const { tmpDir } = await assembler.assembleFinalVideo({
      projectId,
      sceneVideoKeys: scenes.map((s) => s.videoKey),
      subtitlesKey: project.subtitlesKey || null,
      musicKey: music?.r2Key || null,
      musicVolume: Number(project.musicVolume) || 0.15,
      subtitleSettings: project.subtitleSettings || {},
      colorGrade: style?.ffmpegColorGrade || null,
      outputKey,
    });

    await projectRepo.update(projectId, { outputKey });
    await projectRepo.updateStatus(projectId, 'complete');

    await pubsub.publish(projectId, { phase: 'assembly', status: 'complete', outputKey });

    // Clean up the tmp dir after success.
    if (tmpDir) await assembler.cleanupTmpDir(tmpDir);

    return { outputKey };
  } catch (err) {
    await projectRepo.updateStatus(projectId, 'failed', err.message);
    await pubsub.publish(projectId, { phase: 'assembly', status: 'failed', error: err.message });
    throw err;
  }
};
