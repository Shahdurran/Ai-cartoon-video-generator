import { useState, useEffect } from 'react';
import { Video, RefreshCw, Search, Check, X, Upload, Trash2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v2';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const VideoBankBrowser = ({ selectedVideos = [], onSelectionChange, selectionMode = true }) => {
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, duration, date
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    filterAndSortVideos();
  }, [videos, searchTerm, sortBy]);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/video-bank/scan`);
      setVideos(response.data.videos);
      setStats(response.data.stats);
    } catch (err) {
      setError('Failed to load videos: ' + err.message);
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/video-bank/refresh`);
      setVideos(response.data.videos);
      setStats(response.data.stats);
    } catch (err) {
      setError('Failed to refresh videos: ' + err.message);
      console.error('Error refreshing videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortVideos = () => {
    let filtered = [...videos];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(video =>
        video.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'duration':
          return b.duration - a.duration;
        case 'date':
          return new Date(b.addedAt) - new Date(a.addedAt);
        default:
          return 0;
      }
    });

    setFilteredVideos(filtered);
  };

  const toggleSelection = (video) => {
    if (!selectionMode) return;

    const isSelected = selectedVideos.some(v => v.filename === video.filename);
    if (isSelected) {
      onSelectionChange(selectedVideos.filter(v => v.filename !== video.filename));
    } else {
      onSelectionChange([...selectedVideos, video]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredVideos);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const isSelected = (video) => {
    return selectedVideos.some(v => v.filename === video.filename);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload MP4, MOV, AVI, or WebM files.');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 500MB.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await axios.post(`${API_BASE_URL}/video-bank/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        },
      });

      console.log('Upload successful:', response.data);
      
      // Refresh videos list
      await loadVideos();
    } catch (err) {
      setError('Failed to upload video: ' + (err.response?.data?.error || err.message));
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
        <span className="ml-3 text-gray-600">Loading video bank...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <X className="text-red-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-red-800 font-semibold mb-1">Error Loading Videos</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadVideos}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-blue-600 font-semibold">Total Videos</div>
              <div className="text-blue-900 text-lg">{stats.totalVideos}</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">Total Duration</div>
              <div className="text-blue-900 text-lg">{formatDuration(stats.totalDuration)}</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">Total Size</div>
              <div className="text-blue-900 text-lg">{formatFileSize(stats.totalSize)}</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">Avg Duration</div>
              <div className="text-blue-900 text-lg">{formatDuration(stats.averageDuration)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={refreshVideos}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition cursor-pointer">
            <Upload size={16} />
            Upload Video
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          
          {selectionMode && (
            <>
              <button
                onClick={selectAll}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Check size={16} />
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                <X size={16} />
                Deselect All
              </button>
            </>
          )}
        </div>

        {/* Search and Sort */}
        <div className="flex gap-2 flex-1 md:flex-initial">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="duration">Sort by Duration</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>
      </div>

      {/* Selection Count */}
      {selectionMode && selectedVideos.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-green-800 font-semibold">
            {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Video Grid */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Video className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-gray-700 font-semibold mb-1">
            {searchTerm ? 'No videos match your search' : 'No videos in bank'}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? 'Try a different search term' : 'Add videos to the ./video-bank folder'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.filename}
              onClick={() => toggleSelection(video)}
              className={`relative border-2 rounded-lg overflow-hidden transition cursor-pointer ${
                isSelected(video)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 bg-white'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-900">
                {video.thumbnail ? (
                  <img
                    src={`${BACKEND_URL}${video.thumbnail}`}
                    alt={video.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Video className="text-gray-600" size={48} />
                  </div>
                )}
                
                {/* Selection Checkbox */}
                {selectionMode && (
                  <div className="absolute top-2 right-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                      isSelected(video) ? 'bg-blue-600' : 'bg-white bg-opacity-75'
                    }`}>
                      {isSelected(video) && <Check className="text-white" size={16} />}
                    </div>
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(video.duration)}
                </div>
              </div>

              {/* Video Info */}
              <div className="p-3">
                <div className="text-sm font-semibold text-gray-800 truncate" title={video.filename}>
                  {video.filename}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>{video.resolution}</span>
                  <span>{formatFileSize(video.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoBankBrowser;

