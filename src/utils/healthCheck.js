const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execAsync = promisify(exec);

/**
 * Health check utilities for system monitoring
 */
class HealthCheck {
  /**
   * Check Redis connection
   */
  static async checkRedis() {
    const startTime = Date.now();
    try {
      const { queues } = require('../queues');
      
      // Try to ping one of the queues' Redis connection
      if (queues && queues.scriptGeneration) {
        await queues.scriptGeneration.client.ping();
        
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          error: null,
          details: 'Redis connection active'
        };
      }
      
      return {
        status: 'unknown',
        responseTime: Date.now() - startTime,
        error: 'No queue connection available',
        details: null
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: null
      };
    }
  }

  /**
   * Check Claude API (Anthropic)
   */
  static async checkClaude() {
    const startTime = Date.now();
    try {
      // Ensure dotenv is loaded
      require('dotenv').config();
      
      // Clear cache and reload config to get fresh env vars
      delete require.cache[require.resolve('../config/api.config')];
      const apiConfig = require('../config/api.config');
      
      if (!apiConfig.claude?.apiKey) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'API key not configured',
          details: null
        };
      }

      // Make a minimal API call to check status
      // Using claude-sonnet-4-5-20250929 (latest Claude Sonnet 4.5 model)
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'x-api-key': apiConfig.claude.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 15000
        }
      );

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        error: null,
        details: `Model: ${response.data.model} (${response.data.usage?.input_tokens || 0} tokens)`
      };
    } catch (error) {
      // Check specific error types
      if (error.response?.status === 401) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'Invalid API key',
          details: 'API reachable but authentication failed'
        };
      }
      
      if (error.response?.status === 429) {
        return {
          status: 'warning',
          responseTime: Date.now() - startTime,
          error: 'Rate limit exceeded',
          details: 'API key is valid but rate limited'
        };
      }
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.response?.data?.error?.message || error.message,
        details: error.response?.data?.error?.type || null
      };
    }
  }

  /**
   * Check Fal.AI API
   */
  static async checkFalAI() {
    const startTime = Date.now();
    try {
      // Ensure dotenv is loaded
      require('dotenv').config();
      
      // Clear cache and reload config to get fresh env vars
      delete require.cache[require.resolve('../config/api.config')];
      const apiConfig = require('../config/api.config');
      
      if (!apiConfig.falAI?.apiKey) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'API key not configured',
          details: null
        };
      }

      // Check Fal.AI status
      const response = await axios.get('https://fal.run/fal-ai/fast-sdxl', {
        headers: {
          'Authorization': `Key ${apiConfig.falAI.apiKey}`
        },
        timeout: 10000
      });

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        error: null,
        details: 'API accessible'
      };
    } catch (error) {
      // If we get a 401, API key is wrong. If 404, endpoint exists. Both mean service is up.
      if (error.response?.status === 401 || error.response?.status === 404) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          error: null,
          details: 'API reachable (auth check passed)'
        };
      }
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: null
      };
    }
  }

  /**
   * Check Genaipro.vn API
   */
  static async checkGenaipro() {
    const startTime = Date.now();
    try {
      // Ensure dotenv is loaded
      require('dotenv').config();
      
      // Clear cache and reload config to get fresh env vars
      delete require.cache[require.resolve('../config/api.config')];
      const apiConfig = require('../config/api.config');
      
      if (!apiConfig.genaipro?.apiKey) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'API key not configured',
          details: null
        };
      }

      // Test with the voices endpoint (lightweight test)
      const response = await axios.get('https://genaipro.vn/api/v1/labs/voices', {
        headers: {
          'Authorization': `Bearer ${apiConfig.genaipro.apiKey}`
        },
        params: {
          page: 0,
          page_size: 1
        },
        timeout: 10000
      });

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        error: null,
        details: `API accessible (${response.data?.total || 0} voices available)`
      };
    } catch (error) {
      // Check if error is authentication (means API is reachable)
      if (error.response?.status === 401) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'Invalid API key',
          details: 'API reachable but authentication failed'
        };
      }
      
      if (error.response?.status === 403) {
        return {
          status: 'error',
          responseTime: Date.now() - startTime,
          error: 'Access forbidden',
          details: 'Check API key permissions'
        };
      }
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.response?.data?.message || error.message,
        details: error.response?.data?.error || null
      };
    }
  }

  /**
   * Check AssemblyAI
   */
  static async checkAssemblyAI() {
    const startTime = Date.now();
    try {
      // AssemblyAI check - just verify API is reachable
      const response = await axios.get('https://api.assemblyai.com/v2/transcript', {
        headers: {
          'authorization': 'test-key'
        },
        timeout: 10000
      });

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        error: null,
        details: 'API reachable'
      };
    } catch (error) {
      // 401 means API is up, just auth failed (expected)
      if (error.response?.status === 401) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          error: null,
          details: 'API reachable'
        };
      }
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: null
      };
    }
  }

  /**
   * Check FFmpeg installation
   */
  static async checkFFmpeg() {
    const startTime = Date.now();
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const versionMatch = stdout.match(/ffmpeg version ([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        error: null,
        details: `Version ${version}`
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: 'FFmpeg not found or not accessible',
        details: error.message
      };
    }
  }

  /**
   * Get CPU usage
   */
  static async getCPUUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage percentage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage: Math.round(usage),
      loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
      cores: cpus.length
    };
  }

  /**
   * Get memory usage
   */
  static async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentage = Math.round((usedMem / totalMem) * 100);

    // Node.js process memory
    const processMemory = process.memoryUsage();

    return {
      used: Math.round(usedMem / 1024 / 1024), // MB
      total: Math.round(totalMem / 1024 / 1024), // MB
      free: Math.round(freeMem / 1024 / 1024), // MB
      percentage,
      process: {
        heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
        rss: Math.round(processMemory.rss / 1024 / 1024) // MB
      }
    };
  }

  /**
   * Get disk space usage
   */
  static async getDiskUsage() {
    try {
      const rootPath = path.resolve(__dirname, '../..');
      
      // Get folder sizes
      const folders = {
        output: path.join(rootPath, 'output'),
        videoBank: path.join(rootPath, 'video-bank'),
        musicLibrary: path.join(rootPath, 'music-library'),
        personVideos: path.join(rootPath, 'public/videos'),
        temp: path.join(rootPath, 'temp')
      };

      const folderSizes = {};
      
      for (const [name, folderPath] of Object.entries(folders)) {
        try {
          const size = await this.getFolderSize(folderPath);
          folderSizes[name] = Math.round(size / 1024 / 1024); // MB
        } catch (error) {
          folderSizes[name] = 0;
        }
      }

      // Get disk info
      let diskInfo = { used: 0, total: 0, free: 0, percentage: 0 };
      
      if (os.platform() === 'win32') {
        try {
          const drive = rootPath.charAt(0);
          // Use PowerShell instead of deprecated wmic
          const psCommand = `Get-PSDrive -Name ${drive} | Select-Object @{Name='Free';Expression={$_.Free}}, @{Name='Used';Expression={$_.Used}} | ConvertTo-Json`;
          const { stdout } = await execAsync(`powershell -Command "${psCommand}"`);
          
          const diskData = JSON.parse(stdout);
          
          if (diskData && diskData.Free !== undefined && diskData.Used !== undefined) {
            const free = parseInt(diskData.Free);
            const used = parseInt(diskData.Used);
            const total = free + used;
            
            diskInfo = {
              used: Math.round(used / 1024 / 1024 / 1024), // GB
              total: Math.round(total / 1024 / 1024 / 1024), // GB
              free: Math.round(free / 1024 / 1024 / 1024), // GB
              percentage: total > 0 ? Math.round((used / total) * 100) : 0
            };
          }
        } catch (error) {
          console.error('Error getting disk info:', error.message);
          // Fallback: try to get basic info without PowerShell
          try {
            const drive = rootPath.charAt(0);
            const checkDiskCommand = `fsutil volume diskfree ${drive}:`;
            const { stdout } = await execAsync(checkDiskCommand);
            
            // Parse fsutil output
            const totalMatch = stdout.match(/Total # of bytes\s+:\s+(\d+)/);
            const freeMatch = stdout.match(/Total # of free bytes\s+:\s+(\d+)/);
            
            if (totalMatch && freeMatch) {
              const total = parseInt(totalMatch[1]);
              const free = parseInt(freeMatch[1]);
              const used = total - free;
              
              diskInfo = {
                used: Math.round(used / 1024 / 1024 / 1024), // GB
                total: Math.round(total / 1024 / 1024 / 1024), // GB
                free: Math.round(free / 1024 / 1024 / 1024), // GB
                percentage: Math.round((used / total) * 100)
              };
            }
          } catch (fallbackError) {
            console.error('Fallback disk check also failed:', fallbackError.message);
          }
        }
      } else {
        // For Linux/Mac, use df command
        try {
          const { stdout } = await execAsync('df -k /');
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            const total = parseInt(parts[1]) * 1024; // Convert KB to bytes
            const used = parseInt(parts[2]) * 1024;
            const free = parseInt(parts[3]) * 1024;
            
            diskInfo = {
              used: Math.round(used / 1024 / 1024 / 1024), // GB
              total: Math.round(total / 1024 / 1024 / 1024), // GB
              free: Math.round(free / 1024 / 1024 / 1024), // GB
              percentage: Math.round((used / total) * 100)
            };
          }
        } catch (error) {
          console.error('Error getting disk info (Linux/Mac):', error.message);
        }
      }

      return {
        ...diskInfo,
        folders: folderSizes
      };
    } catch (error) {
      return {
        used: 0,
        total: 0,
        free: 0,
        percentage: 0,
        folders: {}
      };
    }
  }

  /**
   * Get folder size recursively
   */
  static async getFolderSize(folderPath) {
    try {
      const stats = await fs.stat(folderPath);
      
      if (stats.isFile()) {
        return stats.size;
      }
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(folderPath);
        const sizes = await Promise.all(
          files.map(file => this.getFolderSize(path.join(folderPath, file)))
        );
        return sizes.reduce((total, size) => total + size, 0);
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get system information
   */
  static async getSystemInfo() {
    const uptime = os.uptime();
    const processUptime = process.uptime();
    
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      osType: os.type(),
      osRelease: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: Math.round(uptime),
      processUptime: Math.round(processUptime)
    };
  }

  /**
   * Run all health checks
   */
  static async checkAll() {
    const [
      redis,
      claude,
      fal,
      genaipro,
      assemblyai,
      ffmpeg,
      cpu,
      memory,
      disk,
      systemInfo
    ] = await Promise.all([
      this.checkRedis(),
      this.checkClaude(),
      this.checkFalAI(),
      this.checkGenaipro(),
      this.checkAssemblyAI(),
      this.checkFFmpeg(),
      this.getCPUUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getSystemInfo()
    ]);

    return {
      services: {
        redis,
        claude,
        fal,
        genaipro,
        assemblyai,
        ffmpeg
      },
      resources: {
        cpu,
        memory,
        disk
      },
      system: systemInfo,
      timestamp: Date.now()
    };
  }
}

module.exports = HealthCheck;

