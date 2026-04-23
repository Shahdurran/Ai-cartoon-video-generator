const fs = require('fs-extra');
const path = require('path');
const StorageService = require('../services/storageService');
const { paths } = require('../config/paths.config');
const ffmpeg = require('fluent-ffmpeg');

class VideoLibraryController {
  /**
   * List all generated videos with metadata
   */
  static async listVideos(req, res) {
    try {
      const { 
        sort = 'dateDesc',  // dateDesc, dateAsc, titleAsc, titleDesc, durationDesc, durationAsc
        search = '',
        channelId = null,
        status = null,  // completed, failed, processing
        limit = 100,
        offset = 0
      } = req.query;

      const storageService = new StorageService();
      const allProjects = await storageService.listProjects();

      // Filter projects
      let filteredProjects = allProjects.filter(project => {
        // Filter by status
        if (status && project.status !== status) return false;

        // Filter by channel
        if (channelId && project.channelId !== channelId) return false;

        // Filter by search (title, context, or video ID)
        if (search) {
          const searchLower = search.toLowerCase();
          const titleMatch = project.title?.toLowerCase().includes(searchLower);
          const contextMatch = project.context?.toLowerCase().includes(searchLower);
          const idMatch = project.id?.toLowerCase().includes(searchLower);
          
          if (!titleMatch && !contextMatch && !idMatch) return false;
        }

        return true;
      });

      // Sort projects
      filteredProjects.sort((a, b) => {
        switch (sort) {
          case 'dateDesc':
            return new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt);
          case 'dateAsc':
            return new Date(a.completedAt || a.createdAt) - new Date(b.completedAt || b.createdAt);
          case 'titleAsc':
            return (a.title || '').localeCompare(b.title || '');
          case 'titleDesc':
            return (b.title || '').localeCompare(a.title || '');
          case 'durationDesc':
            return (b.videoDuration || 0) - (a.videoDuration || 0);
          case 'durationAsc':
            return (a.videoDuration || 0) - (b.videoDuration || 0);
          default:
            return new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt);
        }
      });

      // Paginate
      const total = filteredProjects.length;
      const paginatedProjects = filteredProjects.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      // Build response with video file existence check
      const videos = await Promise.all(paginatedProjects.map(async (project) => {
        const videoExists = project.videoPath && await fs.pathExists(project.videoPath);
        
        // Get file size and relative path if video exists
        let fileSize = null;
        let videoFilename = null;
        let thumbnail = null;

        if (videoExists) {
          try {
            const stats = await fs.stat(project.videoPath);
            fileSize = stats.size;
            videoFilename = path.basename(project.videoPath);
            
            // Generate thumbnail path (we'll create thumbnails in output/thumbnails/)
            const thumbnailDir = path.join(paths.output, 'thumbnails');
            await fs.ensureDir(thumbnailDir);
            const thumbnailFilename = `${path.basename(project.videoPath, '.mp4')}.jpg`;
            const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
            
            // Check if thumbnail exists, if not generate it
            if (await fs.pathExists(thumbnailPath)) {
              thumbnail = `/output/thumbnails/${thumbnailFilename}`;
            } else {
              // Generate thumbnail automatically
              try {
                await new Promise((resolve, reject) => {
                  ffmpeg(project.videoPath)
                    .screenshots({
                      timestamps: ['00:00:02'],
                      filename: thumbnailFilename,
                      folder: thumbnailDir,
                      size: '640x?'
                    })
                    .on('end', () => {
                      console.log(`✅ Auto-generated thumbnail for ${project.id}`);
                      resolve();
                    })
                    .on('error', reject);
                });
                thumbnail = `/output/thumbnails/${thumbnailFilename}`;
              } catch (thumbErr) {
                console.error(`Failed to auto-generate thumbnail for ${project.id}:`, thumbErr.message);
              }
            }
          } catch (err) {
            console.error(`Error getting video stats for ${project.id}:`, err.message);
          }
        }

        return {
          id: project.id,
          title: project.title || 'Untitled Video',
          context: project.context || '',
          channelId: project.channelId || null,
          status: project.status || 'unknown',
          videoPath: videoExists ? videoFilename : null,
          videoUrl: videoExists ? `/output/${videoFilename}` : null,
          thumbnail,
          duration: project.videoDuration || null,
          fileSize,
          metadata: project.videoMetadata || {},
          batchId: project.batchId || null,
          createdAt: project.createdAt,
          completedAt: project.completedAt || null,
          updatedAt: project.updatedAt || project.createdAt,
        };
      }));

      res.json({
        success: true,
        videos,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
      });
    } catch (error) {
      console.error('List videos error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get single video details
   */
  static async getVideo(req, res) {
    try {
      const { videoId } = req.params;

      const storageService = new StorageService();
      const project = await storageService.getProject(videoId);

      const videoExists = project.videoPath && await fs.pathExists(project.videoPath);

      let fileSize = null;
      let videoFilename = null;
      let thumbnail = null;

      if (videoExists) {
        const stats = await fs.stat(project.videoPath);
        fileSize = stats.size;
        videoFilename = path.basename(project.videoPath);

        // Check for thumbnail
        const thumbnailDir = path.join(paths.output, 'thumbnails');
        const thumbnailFilename = `${path.basename(project.videoPath, '.mp4')}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
        
        if (await fs.pathExists(thumbnailPath)) {
          thumbnail = `/output/thumbnails/${thumbnailFilename}`;
        }
      }

      res.json({
        success: true,
        video: {
          id: project.id,
          title: project.title || 'Untitled Video',
          context: project.context || '',
          channelId: project.channelId || null,
          status: project.status || 'unknown',
          videoPath: videoExists ? videoFilename : null,
          videoUrl: videoExists ? `/output/${videoFilename}` : null,
          thumbnail,
          duration: project.videoDuration || null,
          fileSize,
          metadata: project.videoMetadata || {},
          batchId: project.batchId || null,
          createdAt: project.createdAt,
          completedAt: project.completedAt || null,
          updatedAt: project.updatedAt || project.createdAt,
          // Include full project data for detailed view
          steps: project.steps || {},
          config: project.config || {},
        },
      });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Generate thumbnail for a video
   */
  static async generateThumbnail(req, res) {
    try {
      const { videoId } = req.params;
      const { timestamp = '00:00:02' } = req.body;

      const storageService = new StorageService();
      const project = await storageService.getProject(videoId);

      if (!project.videoPath || !await fs.pathExists(project.videoPath)) {
        return res.status(404).json({
          success: false,
          error: 'Video file not found'
        });
      }

      const thumbnailDir = path.join(paths.output, 'thumbnails');
      await fs.ensureDir(thumbnailDir);

      const thumbnailFilename = `${path.basename(project.videoPath, '.mp4')}.jpg`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

      await new Promise((resolve, reject) => {
        ffmpeg(project.videoPath)
          .screenshots({
            timestamps: [timestamp],
            filename: thumbnailFilename,
            folder: thumbnailDir,
            size: '640x?'
          })
          .on('end', resolve)
          .on('error', reject);
      });

      res.json({
        success: true,
        thumbnail: `/output/thumbnails/${thumbnailFilename}`,
        message: 'Thumbnail generated successfully'
      });
    } catch (error) {
      console.error('Generate thumbnail error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Delete a video and its project data
   */
  static async deleteVideo(req, res) {
    try {
      const { videoId } = req.params;

      const storageService = new StorageService();
      const project = await storageService.getProject(videoId);

      // Delete video file
      if (project.videoPath && await fs.pathExists(project.videoPath)) {
        await fs.remove(project.videoPath);
        console.log(`Deleted video file: ${project.videoPath}`);
      }

      // Delete thumbnail if exists
      const thumbnailDir = path.join(paths.output, 'thumbnails');
      const thumbnailFilename = `${path.basename(project.videoPath, '.mp4')}.jpg`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
        console.log(`Deleted thumbnail: ${thumbnailPath}`);
      }

      // Delete project JSON
      const projectPath = path.join(paths.projects, `${videoId}.json`);
      if (await fs.pathExists(projectPath)) {
        await fs.remove(projectPath);
        console.log(`Deleted project data: ${projectPath}`);
      }

      res.json({
        success: true,
        message: 'Video deleted successfully'
      });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Generate all missing thumbnails
   */
  static async generateAllThumbnails(req, res) {
    try {
      const storageService = new StorageService();
      const allProjects = await storageService.listProjects();

      const thumbnailDir = path.join(paths.output, 'thumbnails');
      await fs.ensureDir(thumbnailDir);

      const results = {
        total: 0,
        generated: 0,
        skipped: 0,
        failed: 0,
      };

      for (const project of allProjects) {
        if (!project.videoPath || !await fs.pathExists(project.videoPath)) {
          continue;
        }

        results.total++;

        const thumbnailFilename = `${path.basename(project.videoPath, '.mp4')}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

        // Skip if thumbnail already exists
        if (await fs.pathExists(thumbnailPath)) {
          results.skipped++;
          continue;
        }

        try {
          await new Promise((resolve, reject) => {
            ffmpeg(project.videoPath)
              .screenshots({
                timestamps: ['00:00:02'],
                filename: thumbnailFilename,
                folder: thumbnailDir,
                size: '640x?'
              })
              .on('end', resolve)
              .on('error', reject);
          });
          results.generated++;
          console.log(`✅ Generated thumbnail for ${project.id}`);
        } catch (error) {
          results.failed++;
          console.error(`❌ Failed to generate thumbnail for ${project.id}:`, error.message);
        }
      }

      res.json({
        success: true,
        message: 'Thumbnail generation complete',
        results,
      });
    } catch (error) {
      console.error('Generate all thumbnails error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get video library statistics
   */
  static async getStats(req, res) {
    try {
      const storageService = new StorageService();
      const allProjects = await storageService.listProjects();

      const stats = {
        total: allProjects.length,
        completed: allProjects.filter(p => p.status === 'completed').length,
        processing: allProjects.filter(p => p.status === 'processing').length,
        failed: allProjects.filter(p => p.status === 'failed').length,
        totalDuration: allProjects.reduce((sum, p) => sum + (p.videoDuration || 0), 0),
        byChannel: {},
      };

      // Group by channel
      allProjects.forEach(project => {
        const channelId = project.channelId || 'uncategorized';
        if (!stats.byChannel[channelId]) {
          stats.byChannel[channelId] = {
            count: 0,
            completed: 0,
          };
        }
        stats.byChannel[channelId].count++;
        if (project.status === 'completed') {
          stats.byChannel[channelId].completed++;
        }
      });

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
}

module.exports = VideoLibraryController;

