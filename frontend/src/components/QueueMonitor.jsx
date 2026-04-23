import { useState, useEffect } from 'react';
import { RefreshCw, XCircle, Clock, CheckCircle, AlertCircle, Play, Trash2 } from 'lucide-react';
import { videoAPI } from '../services/api';

const QueueMonitor = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState(''); // Filter by status
  const [queueFilter, setQueueFilter] = useState(''); // Filter by queue name

  useEffect(() => {
    loadQueue();
    
    if (autoRefresh) {
      const interval = setInterval(loadQueue, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadQueue = async () => {
    try {
      const data = await videoAPI.getQueue();
      
      // Process jobs from all queues
      const allJobs = [];
      
      // Response structure: { success: true, queues: { queueName1: {...}, queueName2: {...} } }
      if (data.queues && typeof data.queues === 'object') {
        const queueNames = Object.keys(data.queues);
        
        queueNames.forEach(queueName => {
          const queue = data.queues[queueName];
          
          // Each queue has a 'jobs' object with { waiting: [], active: [], completed: [], failed: [] }
          if (queue.jobs && typeof queue.jobs === 'object') {
            // Iterate through job status categories (waiting, active, completed, failed)
            Object.keys(queue.jobs).forEach(statusKey => {
              const statusJobs = queue.jobs[statusKey];
              if (Array.isArray(statusJobs) && statusJobs.length > 0) {
                allJobs.push(...statusJobs.map((job, index) => ({
                  ...job,
                  uniqueKey: `${queueName}-${job.id}-${index}`, // Create unique key
                  queueName: queueName, // Add queue name
                  queueStatus: statusKey, // Add status category
                })));
              }
            });
          }
        });
      }

      setJobs(allJobs);
      setError(null);
    } catch (err) {
      setError('Failed to load queue: ' + err.message);
      console.error('Error loading queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    try {
      await videoAPI.cancelJob(jobId);
      await loadQueue();
    } catch (err) {
      alert('Failed to cancel job: ' + err.message);
    }
  };

  const handleDeleteJob = async (jobId, queueName) => {
    if (!window.confirm('Are you sure you want to delete this job from the queue?')) {
      return;
    }

    try {
      await videoAPI.deleteJob(jobId, queueName);
      await loadQueue();
    } catch (err) {
      alert('Failed to delete job: ' + err.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'failed':
        return <AlertCircle className="text-red-600" size={20} />;
      case 'active':
      case 'processing':
        return <Play className="text-blue-600" size={20} />;
      default:
        return <Clock className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'active':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatProgress = (progress) => {
    if (typeof progress === 'number') {
      return `${Math.round(progress)}%`;
    }
    return '0%';
  };
  
  // Filter jobs based on selected filters
  const filteredJobs = jobs.filter(job => {
    if (statusFilter && job.queueStatus !== statusFilter) return false;
    if (queueFilter && job.queueName !== queueFilter) return false;
    return true;
  });
  
  // Get unique queue names and statuses for filter dropdowns
  const uniqueQueues = [...new Set(jobs.map(j => j.queueName))].sort();
  const uniqueStatuses = [...new Set(jobs.map(j => j.queueStatus))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading queue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Queue Monitor</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (2s)
          </label>
          <button
            onClick={loadQueue}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {/* Filters */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Queue</label>
              <select
                value={queueFilter}
                onChange={(e) => setQueueFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Queues ({jobs.length})</option>
                {uniqueQueues.map(queue => (
                  <option key={queue} value={queue}>
                    {queue} ({jobs.filter(j => j.queueName === queue).length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses ({jobs.length})</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status} ({jobs.filter(j => j.queueStatus === status).length})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-500">
            {jobs.length === 0 ? 'No jobs in queue' : 'No jobs match the selected filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.uniqueKey || job.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {getStatusIcon(job.state || job.status)}
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {job.name || job.data?.title || `Job ${job.id}`}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {job.queueName && (
                        <span className="font-medium">Queue: {job.queueName}</span>
                      )}
                      {job.queueStatus && (
                        <span className="ml-2">• Status Group: {job.queueStatus}</span>
                      )}
                      {job.data?.channelId && (
                        <span className="ml-2">• Channel: {job.data.channelId}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.state || job.status)}`}>
                    {job.state || job.status || 'waiting'}
                  </span>
                  {(job.state === 'active' || job.state === 'waiting') && (
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      title="Cancel Job"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                  {(job.state === 'completed' || job.state === 'failed') && (
                    <button
                      onClick={() => handleDeleteJob(job.id, job.queueName)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition"
                      title="Delete Job"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {job.progress !== undefined && job.progress > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{formatProgress(job.progress)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {job.timestamp && (
                  <span>Created: {new Date(job.timestamp).toLocaleString()}</span>
                )}
                {job.processedOn && (
                  <span>Started: {new Date(job.processedOn).toLocaleString()}</span>
                )}
                {job.finishedOn && (
                  <span>Finished: {new Date(job.finishedOn).toLocaleString()}</span>
                )}
                {job.attemptsMade !== undefined && (
                  <span>Attempts: {job.attemptsMade}/{job.opts?.attempts || 3}</span>
                )}
              </div>

              {job.failedReason && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <span className="font-medium">Error:</span> {job.failedReason}
                </div>
              )}

              {job.returnvalue && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                  <span className="font-medium">Result:</span>{' '}
                  {typeof job.returnvalue === 'string' 
                    ? job.returnvalue 
                    : (() => {
                        // Display a simple summary based on the result type
                        if (job.returnvalue.success) {
                          const parts = [];
                          if (job.returnvalue.videoPath) parts.push(`Video: ${job.returnvalue.videoPath.split('\\').pop()}`);
                          if (job.returnvalue.audioPath) parts.push(`Audio: ${job.returnvalue.audioPath.split('\\').pop()}`);
                          if (job.returnvalue.script) parts.push(`Script generated (${job.returnvalue.sentences?.length || 0} sentences)`);
                          if (job.returnvalue.projectId) parts.push(`Project: ${job.returnvalue.projectId}`);
                          if (job.returnvalue.duration) parts.push(`Duration: ${Math.round(job.returnvalue.duration)}s`);
                          return parts.length > 0 ? parts.join(' • ') : 'Completed successfully';
                        }
                        return JSON.stringify(job.returnvalue);
                      })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueueMonitor;

