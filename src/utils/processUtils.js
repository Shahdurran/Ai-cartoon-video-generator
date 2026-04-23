const fs = require("fs-extra");

/**
 * Sanitize videoId for filename usage
 * @param {string} videoId - Original video ID
 * @returns {string} Sanitized video ID safe for filenames
 */
function sanitizeVideoId(videoId) {
  return String(videoId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Helper function to cleanup process and temp files
 * @param {string} processId - Process identifier 
 * @param {string} tempDir - Temporary directory path
 * @param {Map} activeProcesses - Map of active FFmpeg processes
 */
async function cleanupProcess(processId, tempDir, activeProcesses = null) {
  try {
    // Kill FFmpeg process if it exists
    if (activeProcesses && activeProcesses.has(processId)) {
      const ffmpegProcess = activeProcesses.get(processId);
      if (ffmpegProcess && ffmpegProcess.kill) {
        console.log(`Killing FFmpeg process for ${processId}`);
        ffmpegProcess.kill('SIGKILL');
      }
      activeProcesses.delete(processId);
    }

    // Cleanup temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.remove(tempDir);
      console.log(`Cleaned up temp directory: ${tempDir}`);
    }
  } catch (error) {
    console.error(`Error during cleanup for ${processId}:`, error);
  }
}

/**
 * Setup request cancellation handlers with delay to avoid immediate triggering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} videoId - Video ID for logging
 * @param {string} processId - Process ID for cleanup
 * @param {string} tempDir - Temporary directory path
 * @param {Map} activeProcesses - Map of active FFmpeg processes
 * @returns {Object} Object with checkRequestActive function and isRequestCanceled flag
 */
function setupRequestCancellationHandlers(req, res, videoId, processId, tempDir, activeProcesses) {
  let isRequestCanceled = false;

  // Set up request cancellation handlers with delay to avoid immediate triggering
  setTimeout(() => {
    if (!res.headersSent) {
      // Handle request cancellation/abortion
      req.on('close', async () => {
        if (!res.headersSent && !isRequestCanceled) {
          console.log(`Request connection closed for video ID: ${videoId}`);
          isRequestCanceled = true;
          await cleanupProcess(processId, tempDir, activeProcesses);
        }
      });

      req.on('aborted', async () => {
        if (!isRequestCanceled) {
          console.log(`Request aborted for video ID: ${videoId}`);
          isRequestCanceled = true;
          await cleanupProcess(processId, tempDir, activeProcesses);
        }
      });
    }
  }, 100);

  // Helper function to check if request is still active
  const checkRequestActive = () => {
    if (isRequestCanceled || res.headersSent) {
      throw new Error('Request was canceled by client');
    }
  };

  return { checkRequestActive, isRequestCanceled: () => isRequestCanceled };
}

module.exports = {
  sanitizeVideoId,
  cleanupProcess,
  setupRequestCancellationHandlers
}; 