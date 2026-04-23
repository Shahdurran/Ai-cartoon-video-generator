import { useState, useEffect } from 'react';
import { 
  X, Search, Upload, RefreshCw, Trash, Play, CheckCircle2, 
  AlertCircle, User, Film, Clock, Maximize2, HelpCircle 
} from 'lucide-react';
import { personVideoAPI, BACKEND_URL } from '../services/api';

const PersonVideoLibraryBrowser = ({ 
  onClose = () => {}, // Default to no-op function
  onSelect, 
  selectionMode = false,
  selectedVideo = null,
  showHeader = true // Allow hiding header when embedded
}) => {
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedItem, setSelectedItem] = useState(selectedVideo);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadVideos();
    loadStats();
  }, []);

  useEffect(() => {
    filterVideos();
  }, [videos, searchQuery]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const response = await personVideoAPI.scan();
      setVideos(response.videos || []);
      setError(null);
    } catch (err) {
      setError('Failed to load person videos: ' + err.message);
      console.error('Load person videos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await personVideoAPI.getStats();
      setStats(response.stats);
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const filterVideos = () => {
    let filtered = [...videos];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.filename.toLowerCase().includes(query)
      );
    }

    setFilteredVideos(filtered);
  };

  const handleRefresh = async () => {
    await loadVideos();
    await loadStats();
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      await personVideoAPI.upload(file, (progress) => {
        setUploadProgress(progress);
      });

      setUploading(false);
      setUploadProgress(0);
      await handleRefresh();
    } catch (err) {
      setError('Failed to upload: ' + err.message);
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      await personVideoAPI.delete(filename);
      await handleRefresh();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleSelect = (video) => {
    setSelectedItem(video);
    if (onSelect && selectionMode) {
      onSelect(video);
    }
  };

  const handleNoOverlay = () => {
    setSelectedItem(null);
    if (onSelect && selectionMode) {
      onSelect(null);
    }
  };

  const getLoopQualityBadge = (quality) => {
    const badges = {
      'poor': { color: 'bg-red-100 text-red-800', label: 'Poor Loop' },
      'fair': { color: 'bg-orange-100 text-orange-800', label: 'Fair Loop' },
      'good': { color: 'bg-green-100 text-green-800', label: 'Good Loop' },
      'excellent': { color: 'bg-blue-100 text-blue-800', label: 'Excellent Loop' },
      'very-long': { color: 'bg-gray-100 text-gray-800', label: 'Very Long' },
    };
    return badges[quality] || badges['fair'];
  };

  // If embedded (showHeader=false), render without modal wrapper
  if (!showHeader) {
    return (
      <div className="flex flex-col h-full">
        {/* Stats Bar */}
        {stats && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <span className="text-gray-700">
                  <strong>{stats.totalVideos}</strong> videos
                </span>
                <span className="text-gray-700">
                  <strong>{stats.videosWithAlpha}</strong> with transparency
                </span>
                <span className="text-gray-700">
                  Total size: <strong>{stats.totalSize}</strong>
                </span>
              </div>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <HelpCircle className="w-4 h-4" />
                Help
              </button>
            </div>
          </div>
        )}

        {/* Help Panel */}
        {showHelp && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
            <h3 className="font-semibold text-gray-800 mb-2">💡 Person Video Tips:</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li><strong>Best Format:</strong> WebM or MOV with alpha channel (transparent background)</li>
              <li><strong>Optimal Duration:</strong> 3-10 seconds for seamless looping</li>
              <li><strong>Resolution:</strong> Match or smaller than background videos (1080p recommended)</li>
              <li><strong>Green Screen:</strong> If no alpha channel, use green screen for chroma keying</li>
              <li><strong>Loop Quality:</strong> Ensure first and last frames match for smooth loops</li>
            </ul>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search person videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-gray-800 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Upload Button */}
            <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept=".mp4,.mov,.webm,.avi"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading person videos...</div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No person videos found</p>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Try a different search' : 'Upload your first person video to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((video) => (
                  <div
                    key={video.filename}
                    onClick={() => handleSelect(video)}
                    className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectionMode && selectedItem?.filename === video.filename
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-gray-100 aspect-video">
                      {video.thumbnail ? (
                        <img
                          src={`${BACKEND_URL}${video.thumbnail}`}
                          alt={video.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      
                      {/* Transparency Badge */}
                      {video.hasAlpha && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Transparent
                        </div>
                      )}

                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewVideo(video);
                        }}
                        className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
                        title="Preview"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-white">
                      <div className="font-medium text-gray-800 text-sm truncate mb-2">
                        {video.filename}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {/* Duration */}
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration.toFixed(1)}s
                        </span>

                        {/* Resolution */}
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          {video.width}x{video.height}
                        </span>

                        {/* Loop Quality */}
                        {(() => {
                          const badge = getLoopQualityBadge(video.loopQuality);
                          return (
                            <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Format & Size */}
                      <div className="text-xs text-gray-500">
                        {video.format.toUpperCase()} • {video.fileSizeFormatted}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {previewVideo && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80]"
            onClick={() => setPreviewVideo(null)}
          >
            <div className="bg-white rounded-lg p-4 max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{previewVideo.filename}</h3>
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <video
                src={`${BACKEND_URL}/person-videos/${previewVideo.filename}`}
                controls
                loop
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full modal version (original)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <User className="w-6 h-6" />
              Person Video Library
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {selectionMode ? 'Select a looping person video overlay' : 'Manage person video overlays'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <span className="text-gray-700">
                  <strong>{stats.totalVideos}</strong> videos
                </span>
                <span className="text-gray-700">
                  <strong>{stats.videosWithAlpha}</strong> with transparency
                </span>
                <span className="text-gray-700">
                  Total size: <strong>{stats.totalSize}</strong>
                </span>
              </div>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <HelpCircle className="w-4 h-4" />
                Help
              </button>
            </div>
          </div>
        )}

        {/* Help Panel */}
        {showHelp && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
            <h3 className="font-semibold text-gray-800 mb-2">💡 Person Video Tips:</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li><strong>Best Format:</strong> WebM or MOV with alpha channel (transparent background)</li>
              <li><strong>Optimal Duration:</strong> 3-10 seconds for seamless looping</li>
              <li><strong>Resolution:</strong> Match or smaller than background videos (1080p recommended)</li>
              <li><strong>Green Screen:</strong> If no alpha channel, use green screen for chroma keying</li>
              <li><strong>Loop Quality:</strong> Ensure first and last frames match for smooth loops</li>
            </ul>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search person videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-gray-800 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Upload Button */}
            <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept=".mp4,.mov,.webm,.avi"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading person videos...</div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No person videos found</p>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Try a different search' : 'Upload your first person video to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* No Overlay Option */}
              {selectionMode && (
                <div
                  onClick={handleNoOverlay}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedItem === null
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={selectedItem === null}
                      onChange={handleNoOverlay}
                      className="w-4 h-4"
                    />
                    <X className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-800">No Person Overlay</div>
                      <div className="text-sm text-gray-600">Don't use any person video overlay</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((video) => (
                  <div
                    key={video.filename}
                    onClick={() => handleSelect(video)}
                    className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectionMode && selectedItem?.filename === video.filename
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-gray-100 aspect-video">
                      {video.thumbnail ? (
                        <img
                          src={`${BACKEND_URL}${video.thumbnail}`}
                          alt={video.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      
                      {/* Transparency Badge */}
                      {video.hasAlpha && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Transparent
                        </div>
                      )}

                      {/* Selection Radio */}
                      {selectionMode && (
                        <div className="absolute top-2 left-2">
                          <input
                            type="radio"
                            checked={selectedItem?.filename === video.filename}
                            onChange={() => handleSelect(video)}
                            className="w-5 h-5"
                          />
                        </div>
                      )}

                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewVideo(video);
                        }}
                        className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
                        title="Preview"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-white">
                      <div className="font-medium text-gray-800 text-sm truncate mb-2">
                        {video.filename}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {/* Duration */}
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration.toFixed(1)}s
                        </span>

                        {/* Resolution */}
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          {video.width}x{video.height}
                        </span>

                        {/* Loop Quality */}
                        {(() => {
                          const badge = getLoopQualityBadge(video.loopQuality);
                          return (
                            <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Format & Size */}
                      <div className="text-xs text-gray-500">
                        {video.format.toUpperCase()} • {video.fileSizeFormatted}
                      </div>

                      {/* Delete Button (non-selection mode) */}
                      {!selectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video.filename);
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded text-sm transition-colors"
                        >
                          <Trash className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredVideos.length} of {videos.length} videos
            </div>
            {selectionMode && (
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Confirm Selection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewVideo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
          onClick={() => setPreviewVideo(null)}
        >
          <div className="bg-white rounded-lg p-4 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{previewVideo.filename}</h3>
              <button
                onClick={() => setPreviewVideo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <video
              src={`${BACKEND_URL}/person-videos/${previewVideo.filename}`}
              controls
              loop
              autoPlay
              className="w-full rounded-lg"
              style={{ maxHeight: '60vh' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonVideoLibraryBrowser;

