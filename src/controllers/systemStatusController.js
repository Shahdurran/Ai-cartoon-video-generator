const HealthCheck = require('../utils/healthCheck');
const { getAllQueuesStats } = require('../queues');
const fs = require('fs').promises;
const path = require('path');

class SystemStatusController {
  /**
   * Get complete system health status
   */
  static async getSystemHealth(req, res) {
    try {
      const health = await HealthCheck.checkAll();
      
      // Add queue statistics
      const queueStats = await getAllQueuesStats();
      let activeJobs = 0;
      let waitingJobs = 0;
      let completedLastHour = 0;
      let failedLastHour = 0;
      
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const [queueName, queueData] of Object.entries(queueStats)) {
        if (queueData.jobs) {
          activeJobs += queueData.jobs.active?.length || 0;
          waitingJobs += queueData.jobs.waiting?.length || 0;
          
          // Count completed in last hour
          if (queueData.jobs.completed) {
            completedLastHour += queueData.jobs.completed.filter(
              job => job.finishedOn >= oneHourAgo
            ).length;
          }
          
          // Count failed in last hour
          if (queueData.jobs.failed) {
            failedLastHour += queueData.jobs.failed.filter(
              job => job.failedOn >= oneHourAgo
            ).length;
          }
        }
      }
      
      health.queues = {
        active: activeJobs,
        waiting: waitingJobs,
        completedLastHour,
        failedLastHour
      };
      
      // Calculate overall system status
      const serviceStatuses = Object.values(health.services).map(s => s.status);
      const hasError = serviceStatuses.includes('error');
      const hasWarning = serviceStatuses.includes('warning');
      
      health.overallStatus = hasError ? 'disruption' : 
                             hasWarning ? 'degraded' : 
                             'operational';
      
      res.json({
        success: true,
        health
      });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Test a specific service
   */
  static async testService(req, res) {
    try {
      const { service } = req.params;
      
      let result;
      
      switch (service) {
        case 'redis':
          result = await HealthCheck.checkRedis();
          break;
        case 'claude':
          result = await HealthCheck.checkClaude();
          break;
        case 'fal':
          result = await HealthCheck.checkFalAI();
          break;
        case 'genaipro':
          result = await HealthCheck.checkGenaipro();
          break;
        case 'assemblyai':
          result = await HealthCheck.checkAssemblyAI();
          break;
        case 'ffmpeg':
          result = await HealthCheck.checkFFmpeg();
          break;
        default:
          return res.status(400).json({ error: 'Unknown service' });
      }
      
      res.json({
        success: true,
        service,
        result
      });
    } catch (error) {
      console.error('Test service error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get API usage statistics
   */
  static async getAPIUsage(req, res) {
    try {
      // This would typically come from a database or usage tracking system
      // For now, return mock data structure
      const usage = {
        claude: {
          tokensToday: 0,
          tokensMonth: 0,
          estimatedCost: 0,
          rateLimitStatus: 'normal'
        },
        fal: {
          creditsRemaining: 0,
          creditsUsedToday: 0,
          lastRecharged: null
        },
        genaipro: {
          requestsToday: 0,
          requestsMonth: 0,
          accountStatus: 'active'
        }
      };
      
      // Try to load usage data if exists
      try {
        const usageFile = path.join(__dirname, '../../storage/api-usage.json');
        const data = await fs.readFile(usageFile, 'utf8');
        const savedUsage = JSON.parse(data);
        Object.assign(usage, savedUsage);
      } catch (error) {
        // File doesn't exist or error reading, use defaults
      }
      
      res.json({
        success: true,
        usage
      });
    } catch (error) {
      console.error('Get API usage error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get resource usage (real-time)
   */
  static async getResourceUsage(req, res) {
    try {
      const cpu = await HealthCheck.getCPUUsage();
      const memory = await HealthCheck.getMemoryUsage();
      const disk = await HealthCheck.getDiskUsage();
      
      res.json({
        success: true,
        resources: {
          cpu,
          memory,
          disk
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Get resource usage error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Export status report
   */
  static async exportStatusReport(req, res) {
    try {
      const health = await HealthCheck.checkAll();
      const queueStats = await getAllQueuesStats();
      
      const report = {
        generatedAt: new Date().toISOString(),
        system: health.system,
        services: health.services,
        resources: health.resources,
        queues: queueStats
      };
      
      // Return as JSON download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="system-status-${Date.now()}.json"`);
      res.json(report);
    } catch (error) {
      console.error('Export status report error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get system information
   */
  static async getSystemInfo(req, res) {
    try {
      const info = await HealthCheck.getSystemInfo();
      const apiConfig = require('../config/api.config');
      const pathsConfig = require('../config/paths.config');
      
      // Add configuration summary (without sensitive data)
      const configSummary = {
        queueConcurrency: {
          scriptGeneration: 2,
          voiceGeneration: 3,
          imageGeneration: 2,
          videoAssembly: 1
        },
        paths: {
          output: pathsConfig.output || './output',
          temp: pathsConfig.temp || './temp',
          videoBank: pathsConfig.videoBank || './video-bank'
        },
        features: {
          claudeEnabled: !!apiConfig.claude?.apiKey,
          falEnabled: !!apiConfig.falAI?.apiKey,
          genaiproEnabled: !!apiConfig.genaipro?.apiKey
        }
      };
      
      res.json({
        success: true,
        info,
        config: configSummary
      });
    } catch (error) {
      console.error('Get system info error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = SystemStatusController;

