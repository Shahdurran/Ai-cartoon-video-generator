const { getAllQueuesStats, getJob } = require('../queues');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class DashboardController {
  /**
   * Get analytics data (daily video counts, processing times, success rates)
   */
  static async getAnalytics(req, res) {
    try {
      const { period = '7days' } = req.query;
      const days = period === '7days' ? 7 : 30;

      // Get all queue stats to access job history
      const stats = await getAllQueuesStats();
      
      // Collect all completed and failed jobs from all queues
      const allJobs = [];
      for (const [queueName, queueData] of Object.entries(stats)) {
        if (queueData.jobs) {
          const completedJobs = queueData.jobs.completed || [];
          const failedJobs = queueData.jobs.failed || [];
          allJobs.push(...completedJobs, ...failedJobs);
        }
      }

      // Generate daily video counts for the last N days
      const now = new Date();
      const dailyCounts = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const count = allJobs.filter(job => {
          const jobDate = new Date(job.finishedOn || job.timestamp);
          return jobDate.toISOString().split('T')[0] === dateStr && 
                 (job.returnvalue?.success || job.failedReason);
        }).length;
        
        dailyCounts.push({
          date: dateStr,
          count,
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
      }

      // Get processing times for last 10 completed jobs
      const completedJobsWithTimes = allJobs
        .filter(job => job.finishedOn && job.processedOn)
        .map(job => ({
          id: job.id,
          name: job.name || `Job ${job.id}`,
          processingTime: Math.round((job.finishedOn - job.processedOn) / 1000), // seconds
          title: (job.data?.videos?.[0]?.title || job.name || `Video ${job.id}`).substring(0, 20)
        }))
        .sort((a, b) => b.id - a.id)
        .slice(0, 10)
        .reverse();

      // Calculate success rate
      const completedCount = allJobs.filter(job => job.returnvalue?.success).length;
      const failedCount = allJobs.filter(job => job.failedReason).length;
      const totalProcessed = completedCount + failedCount;
      const successRate = totalProcessed > 0 ? Math.round((completedCount / totalProcessed) * 100) : 0;

      res.json({
        success: true,
        analytics: {
          dailyVideoCounts: dailyCounts,
          processingTimes: completedJobsWithTimes,
          successRate: {
            success: completedCount,
            failed: failedCount,
            total: totalProcessed,
            percentage: successRate
          }
        }
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get recent activity (last 20 activities from job history)
   */
  static async getRecentActivity(req, res) {
    try {
      const stats = await getAllQueuesStats();
      
      // Collect all jobs from all queues
      const allActivities = [];
      
      for (const [queueName, queueData] of Object.entries(stats)) {
        if (queueData.jobs) {
          // Active jobs
          if (queueData.jobs.active) {
            queueData.jobs.active.forEach(job => {
              allActivities.push({
                id: job.id,
                type: 'video_processing',
                status: 'processing',
                title: job.data?.videos?.[0]?.title || job.name || `Video ${job.id}`,
                timestamp: job.processedOn || job.timestamp || Date.now(),
                queueName,
                metadata: {
                  progress: job.progress || 0,
                  jobId: job.id
                }
              });
            });
          }

          // Completed jobs
          if (queueData.jobs.completed) {
            queueData.jobs.completed.forEach(job => {
              const videoData = job.data?.videos?.[0] || {};
              allActivities.push({
                id: job.id,
                type: 'video_completed',
                status: 'completed',
                title: videoData.title || job.name || `Video ${job.id}`,
                timestamp: job.finishedOn || job.timestamp || Date.now(),
                queueName,
                metadata: {
                  duration: job.finishedOn && job.processedOn 
                    ? Math.round((job.finishedOn - job.processedOn) / 1000) 
                    : 0,
                  videoPath: job.returnvalue?.videoPath,
                  thumbnail: job.returnvalue?.thumbnail,
                  jobId: job.id
                }
              });
            });
          }

          // Failed jobs
          if (queueData.jobs.failed) {
            queueData.jobs.failed.forEach(job => {
              allActivities.push({
                id: job.id,
                type: 'video_failed',
                status: 'failed',
                title: job.data?.videos?.[0]?.title || job.name || `Video ${job.id}`,
                timestamp: job.failedOn || job.timestamp || Date.now(),
                queueName,
                metadata: {
                  error: job.failedReason || 'Unknown error',
                  jobId: job.id
                }
              });
            });
          }
        }
      }

      // Sort by timestamp (most recent first) and take last 20
      const recentActivities = allActivities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20)
        .map(activity => ({
          ...activity,
          timestamp: activity.timestamp,
          timeAgo: this.getTimeAgo(activity.timestamp)
        }));

      res.json({
        success: true,
        activities: recentActivities
      });
    } catch (error) {
      console.error('Get recent activity error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get today's summary statistics
   */
  static async getTodaySummary(req, res) {
    try {
      const stats = await getAllQueuesStats();
      
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      let videosGeneratedToday = 0;
      let totalProcessingTimeToday = 0;
      let totalVideoLength = 0;
      let videoCount = 0;
      const channelUsage = {};

      // Collect all completed jobs from all queues
      for (const [queueName, queueData] of Object.entries(stats)) {
        if (queueData.jobs?.completed) {
          queueData.jobs.completed.forEach(job => {
            if (job.finishedOn >= todayTimestamp) {
              videosGeneratedToday++;
              
              // Add processing time
              if (job.finishedOn && job.processedOn) {
                totalProcessingTimeToday += (job.finishedOn - job.processedOn);
              }

              // Track channel usage
              const channelId = job.data?.videos?.[0]?.channelId;
              if (channelId) {
                channelUsage[channelId] = (channelUsage[channelId] || 0) + 1;
              }

              // Add video length (if available)
              if (job.returnvalue?.metadata?.duration) {
                totalVideoLength += job.returnvalue.metadata.duration;
                videoCount++;
              }
            }
          });
        }
      }

      // Find most used channel
      let mostUsedChannel = 'N/A';
      let maxUsage = 0;
      for (const [channelId, count] of Object.entries(channelUsage)) {
        if (count > maxUsage) {
          maxUsage = count;
          mostUsedChannel = channelId;
        }
      }

      // Calculate averages
      const avgProcessingTime = videosGeneratedToday > 0 
        ? Math.round(totalProcessingTimeToday / videosGeneratedToday / 1000) 
        : 0;
      
      const avgVideoLength = videoCount > 0 
        ? Math.round(totalVideoLength / videoCount) 
        : 0;

      res.json({
        success: true,
        summary: {
          videosGeneratedToday,
          totalProcessingTimeToday: Math.round(totalProcessingTimeToday / 1000), // seconds
          avgProcessingTime, // seconds
          avgVideoLength, // seconds
          mostUsedChannel
        }
      });
    } catch (error) {
      console.error('Get today summary error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Helper: Convert timestamp to relative time string
   */
  static getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }
}

module.exports = DashboardController;

