import { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Download, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  Share2,
  CheckCircle,
  XCircle,
  Clock,
  File,
  Image as ImageIcon,
  Music,
  Video as VideoIcon
} from 'lucide-react';
import { videoAPI } from '../services/api';

const JobDetailsModal = ({ jobId, queueName, isOpen, onClose }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && jobId && queueName) {
      loadJobDetails();
    }
  }, [isOpen, jobId, queueName]);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const response = await videoAPI.getJobStatus(jobId, queueName);
      setJob(response.job);
    } catch (err) {
      console.error('Error loading job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  const handleDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetry = async () => {
    // Retry logic would go here
    console.log('Retry job:', jobId);
    onClose();
  };

  const handleDelete = async () => {
    // Delete logic would go here
    console.log('Delete job:', jobId);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleShare = () => {
    // Share logic would go here
    console.log('Share job:', jobId);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Completed' },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Failed' },
      active: { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Processing' },
      waiting: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Waiting' }
    };
    
    const badge = badges[status] || badges.waiting;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon size={14} />
        {badge.text}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Job Details</h2>
            <p className="text-sm text-gray-500 mt-1">Job ID: {jobId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : !job ? (
          <div className="flex items-center justify-center p-12 text-gray-500">
            Failed to load job details
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b px-6">
              {['overview', 'assets', 'logs', 'settings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <OverviewTab job={job} formatDate={formatDate} formatDuration={formatDuration} getStatusBadge={getStatusBadge} handleCopy={handleCopy} />
              )}
              {activeTab === 'assets' && (
                <AssetsTab job={job} handleDownload={handleDownload} />
              )}
              {activeTab === 'logs' && (
                <LogsTab job={job} />
              )}
              {activeTab === 'settings' && (
                <SettingsTab job={job} handleCopy={handleCopy} />
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t p-6 flex items-center justify-between bg-gray-50">
              <div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="flex items-center gap-3">
                {job.state === 'failed' && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <RefreshCw size={18} />
                    Retry Job
                  </button>
                )}
                {job.state === 'completed' && (
                  <>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Share2 size={18} />
                      Share
                    </button>
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                        Delete
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Are you sure?</span>
                        <button
                          onClick={handleDelete}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ job, formatDate, formatDuration, getStatusBadge, handleCopy }) => {
  const videoData = job.data?.videos?.[0] || {};
  const processingTime = job.finishedOn && job.processedOn 
    ? Math.round((job.finishedOn - job.processedOn) / 1000) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Job Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Job Information</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Job ID:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{job.id}</span>
              <button
                onClick={() => handleCopy(job.id)}
                className="text-blue-500 hover:text-blue-700"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium">{job.name || 'Video Generation'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Channel:</span>
            <span className="font-medium">{videoData.channelId || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Status:</span>
            {getStatusBadge(job.state)}
          </div>
          {job.progress !== undefined && job.state === 'active' && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Progress:</span>
              <div className="flex-1 ml-4 max-w-xs">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Timestamps</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Created:</span>
            <span className="text-sm">{formatDate(job.timestamp)}</span>
          </div>
          {job.processedOn && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Started:</span>
              <span className="text-sm">{formatDate(job.processedOn)}</span>
            </div>
          )}
          {job.finishedOn && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Completed:</span>
              <span className="text-sm">{formatDate(job.finishedOn)}</span>
            </div>
          )}
          {processingTime > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{formatDuration(processingTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Information */}
      {videoData.title && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Video Information</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Title:</span>
              <span className="font-medium">{videoData.title}</span>
            </div>
            {job.returnvalue?.metadata && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span>{formatDuration(job.returnvalue.metadata.duration)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Resolution:</span>
                  <span>{job.returnvalue.metadata.resolution || 'N/A'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Details */}
      {job.failedReason && (
        <div>
          <h3 className="text-lg font-semibold text-red-600 mb-3">Error Details</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 whitespace-pre-wrap">{job.failedReason}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Assets Tab Component
const AssetsTab = ({ job, handleDownload }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const assets = job.returnvalue || {};

  if (job.state !== 'completed') {
    return (
      <div className="text-center py-12 text-gray-500">
        <File size={48} className="mx-auto mb-3 opacity-50" />
        <p>Assets are only available for completed jobs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Final Video */}
      {assets.videoPath && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Final Video</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <video
              controls
              className="w-full rounded-lg mb-3"
              style={{ maxHeight: '400px' }}
            >
              <source src={`http://localhost:3000${assets.videoPath}`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownload(`http://localhost:3000${assets.videoPath}`, 'video.mp4')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Download size={18} />
                Download Video
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                <ExternalLink size={18} />
                Open in Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script */}
      {assets.script && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Script</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="max-h-64 overflow-y-auto mb-3 p-3 bg-white rounded border">
              <p className="text-gray-700 whitespace-pre-wrap">{assets.script}</p>
            </div>
            <button
              onClick={() => handleDownload(`data:text/plain;charset=utf-8,${encodeURIComponent(assets.script)}`, 'script.txt')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              <Copy size={18} />
              Copy Script
            </button>
          </div>
        </div>
      )}

      {/* Audio */}
      {assets.audioPath && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Audio</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <audio controls className="w-full mb-3">
              <source src={`http://localhost:3000${assets.audioPath}`} type="audio/mpeg" />
              Your browser does not support the audio tag.
            </audio>
            <button
              onClick={() => handleDownload(`http://localhost:3000${assets.audioPath}`, 'audio.mp3')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              <Download size={18} />
              Download Audio
            </button>
          </div>
        </div>
      )}

      {/* Images */}
      {assets.images && assets.images.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Images</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              {assets.images.map((img, index) => (
                <div
                  key={index}
                  className="relative group cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={img}
                    alt={`Generated ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                    <ExternalLink className="text-white opacity-0 group-hover:opacity-100" size={24} />
                  </div>
                </div>
              ))}
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              <Download size={18} />
              Download All Images
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

// Logs Tab Component
const LogsTab = ({ job }) => {
  const logs = job.logs || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Execution Logs</h3>
        <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
          <Download size={18} />
          Download Logs
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4 text-gray-400 font-mono text-sm">
          <p>No logs available for this job</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
          <div className="font-mono text-sm space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.level === 'error' ? 'text-red-400' : 
                  log.level === 'warning' ? 'text-yellow-400' : 
                  'text-green-400'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ job, handleCopy }) => {
  const videoData = job.data?.videos?.[0] || {};
  const settings = {
    channelId: videoData.channelId,
    title: videoData.title,
    context: videoData.context,
    customPrompt: videoData.customPrompt,
    referenceScripts: videoData.referenceScripts,
    promptTemplateId: videoData.promptTemplateId,
    personVideoOverlay: videoData.personVideoOverlay
  };

  const settingsJSON = JSON.stringify(settings, null, 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Generation Settings</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(settingsJSON)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            <Copy size={18} />
            Copy Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <RefreshCw size={18} />
            Reuse Settings
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <pre className="text-green-400 font-mono text-sm overflow-x-auto">
          {settingsJSON}
        </pre>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click "Reuse Settings" to open the Video Generator with these exact settings pre-filled.
        </p>
      </div>
    </div>
  );
};

export default JobDetailsModal;

