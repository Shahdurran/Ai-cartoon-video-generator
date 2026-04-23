import { useState, useEffect } from 'react';
import { Play, Trash2, Search, Filter, Download, Calendar, Clock, Film, BarChart3, RefreshCw, X } from 'lucide-react';
import { videoLibraryAPI, channelAPI, BACKEND_URL } from '../services/api';

const VideoLibrary = () => {
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Playback state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadChannels();
    loadStats();
  }, []);

  useEffect(() => {
    loadVideos();
  }, [searchTerm, selectedChannel, sortBy, statusFilter, pagination.offset]);

  const loadChannels = async () => {
    try {
      const response = await channelAPI.list();
      if (response.success) {
        setChannels(response.channels || []);
      }
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await videoLibraryAPI.getStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        search: searchTerm,
        sort: sortBy,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      // Only add optional params if they have values
      if (selectedChannel) {
        params.channelId = selectedChannel;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await videoLibraryAPI.list(params);
      
      console.log('Video Library API Response:', response);
      
      if (response.success) {
        setVideos(response.videos || []);
        setPagination(response.pagination || pagination);
      } else {
        console.error('API returned success: false', response);
        setError(response.error || 'Failed to load videos');
      }
    } catch (err) {
      setError('Failed to load videos: ' + err.message);
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) {
      return;
    }

    try {
      const response = await videoLibraryAPI.delete(videoId);
      if (response.success) {
        loadVideos();
        loadStats();
      }
    } catch (err) {
      alert('Failed to delete video: ' + err.message);
    }
  };

  const handlePlayVideo = (video) => {
    setSelectedVideo(video);
    setShowVideoPlayer(true);
  };

  const handleDownloadVideo = (video) => {
    window.open(`${BACKEND_URL}${video.videoUrl}`, '_blank');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedChannel('');
    setSortBy('dateDesc');
    setStatusFilter('');
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Film className="text-blue-600" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Video Library</h2>
              <p className="text-gray-600 text-sm">All generated videos</p>
            </div>
          </div>
          <button
            onClick={() => { loadVideos(); loadStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Film size={16} className="text-blue-600" />
                <span className="text-sm text-blue-800 font-medium">Total Videos</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-green-600" />
                <span className="text-sm text-green-800 font-medium">Completed</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{stats.completed}</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-yellow-600" />
                <span className="text-sm text-yellow-800 font-medium">Processing</span>
              </div>
              <div className="text-2xl font-bold text-yellow-900">{stats.processing}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-purple-600" />
                <span className="text-sm text-purple-800 font-medium">Total Duration</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{formatDuration(stats.totalDuration)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h3 className="font-semibold text-gray-800">Filters & Search</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Title, context, or ID..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Channel Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Channels</option>
              {channels.map(channel => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} {channel.type ? `(${channel.type})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="dateDesc">Newest First</option>
              <option value="dateAsc">Oldest First</option>
              <option value="titleAsc">Title A-Z</option>
              <option value="titleDesc">Title Z-A</option>
              <option value="durationDesc">Longest First</option>
              <option value="durationAsc">Shortest First</option>
            </select>
          </div>
        </div>

        {/* Reset Button */}
        {(searchTerm || selectedChannel || statusFilter || sortBy !== 'dateDesc') && (
          <div className="mt-4">
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Video Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No videos found</p>
            <p className="text-sm text-gray-500">
              {searchTerm || selectedChannel || statusFilter
                ? 'Try adjusting your filters'
                : 'Generate your first video to see it here'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition group">
                  {/* Thumbnail/Preview */}
                  <div className="relative aspect-video bg-gray-900">
                    {video.thumbnail ? (
                      <img
                        src={`${BACKEND_URL}${video.thumbnail}`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-16 h-16 text-gray-600" />
                      </div>
                    )}
                    
                    {/* Play Button Overlay */}
                    {video.videoUrl && (
                      <button
                        onClick={() => handlePlayVideo(video)}
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-40 transition"
                      >
                        <div className="bg-blue-600 rounded-full p-4 opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      </button>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      {video.status === 'completed' && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Completed</span>
                      )}
                      {video.status === 'processing' && (
                        <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded">Processing</span>
                      )}
                      {video.status === 'failed' && (
                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">Failed</span>
                      )}
                    </div>

                    {/* Duration */}
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-1 truncate" title={video.title}>
                      {video.title}
                    </h3>
                    {video.context && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2" title={video.context}>
                        {video.context}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{new Date(video.completedAt || video.createdAt).toLocaleDateString()}</span>
                      </div>
                      {video.fileSize && (
                        <div className="flex items-center gap-1">
                          <Film size={12} />
                          <span>{formatFileSize(video.fileSize)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {video.videoUrl && (
                        <>
                          <button
                            onClick={() => handlePlayVideo(video)}
                            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition"
                          >
                            <Play size={14} />
                            Play
                          </button>
                          <button
                            onClick={() => handleDownloadVideo(video)}
                            className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    disabled={pagination.offset === 0}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    disabled={!pagination.hasMore}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowVideoPlayer(false)}>
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{selectedVideo.title}</h3>
                <p className="text-sm text-gray-600">{formatDate(selectedVideo.completedAt || selectedVideo.createdAt)}</p>
              </div>
              <button
                onClick={() => setShowVideoPlayer(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Player */}
            <div className="bg-black">
              <video
                src={`${BACKEND_URL}${selectedVideo.videoUrl}`}
                controls
                autoPlay
                className="w-full max-h-[70vh]"
              />
            </div>

            {/* Video Details */}
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="ml-2 font-medium">{formatDuration(selectedVideo.duration)}</span>
                </div>
                <div>
                  <span className="text-gray-600">File Size:</span>
                  <span className="ml-2 font-medium">{formatFileSize(selectedVideo.fileSize)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Resolution:</span>
                  <span className="ml-2 font-medium">{selectedVideo.metadata?.resolution || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium">{selectedVideo.metadata?.type || 'N/A'}</span>
                </div>
              </div>
              
              {selectedVideo.context && (
                <div className="mt-4">
                  <span className="text-gray-600 text-sm">Context:</span>
                  <p className="text-sm text-gray-800 mt-1">{selectedVideo.context}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;

