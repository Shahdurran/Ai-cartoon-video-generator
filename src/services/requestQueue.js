/**
 * Request Queue Class for managing video processing requests
 */
class RequestQueue {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
    this.activeJobs = new Map(); // Track active jobs with their start times
    this.jobTimeouts = new Map(); // Track job timeout handlers
    this.maxJobTimeout = 45 * 60 * 1000; // 45 minutes
  }

  async add(requestHandler) {
    return new Promise((resolve, reject) => {
      this.queue.push({ handler: requestHandler, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { handler, resolve, reject } = this.queue.shift();

    try {
      const result = await handler();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      // Process the next request in queue
      setTimeout(() => this.processNext(), 100);
    }
  }

  getQueueStatus() {
    const activeJobsInfo = Array.from(this.activeJobs.entries()).map(([jobId, info]) => ({
      jobId,
      runningTime: Date.now() - info.startTime,
      timeoutIn: info.timeoutMs - (Date.now() - info.startTime)
    }));

    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      activeJobs: activeJobsInfo,
      estimatedWaitTime: this.calculateEstimatedWaitTime()
    };
  }

  calculateEstimatedWaitTime() {
    if (!this.isProcessing && this.queue.length === 0) {
      return 0;
    }

    // Average processing time (in milliseconds) - adjust based on your server's performance
    const avgProcessingTime = 15 * 60 * 1000; // 15 minutes average

    if (this.isProcessing) {
      // If currently processing, add time for current job plus all queued jobs
      return avgProcessingTime * (this.queue.length + 1);
    } else {
      // If not processing, just add time for queued jobs
      return avgProcessingTime * this.queue.length;
    }
  }
}

module.exports = RequestQueue; 