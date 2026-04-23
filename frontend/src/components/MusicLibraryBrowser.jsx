import { useState, useEffect, useRef } from 'react';
import { Music, RefreshCw, Search, Play, Pause, Upload, Trash2, X } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v2';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const MusicLibraryBrowser = ({ selectedMusic = null, onSelectionChange, allowNoMusic = true }) => {
  const [musicList, setMusicList] = useState([]);
  const [filteredMusic, setFilteredMusic] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, duration, date
  const [error, setError] = useState(null);
  const [playingMusic, setPlayingMusic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    loadMusic();
  }, []);

  useEffect(() => {
    filterAndSortMusic();
  }, [musicList, searchTerm, sortBy]);

  const loadMusic = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/music-library/scan`);
      setMusicList(response.data.music);
      setStats(response.data.stats);
    } catch (err) {
      setError('Failed to load music: ' + err.message);
      console.error('Error loading music:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMusic = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/music-library/refresh`);
      setMusicList(response.data.music);
      setStats(response.data.stats);
    } catch (err) {
      setError('Failed to refresh music: ' + err.message);
      console.error('Error refreshing music:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortMusic = () => {
    let filtered = [...musicList];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(music =>
        music.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        music.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        music.artist.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'duration':
          return b.duration - a.duration;
        case 'date':
          return new Date(b.addedAt) - new Date(a.addedAt);
        default:
          return 0;
      }
    });

    setFilteredMusic(filtered);
  };

  const handleSelection = (music) => {
    // Stop playing if switching selection
    if (playingMusic) {
      stopMusic();
    }
    onSelectionChange(music);
  };

  const handleNoMusic = () => {
    if (playingMusic) {
      stopMusic();
    }
    onSelectionChange(null);
  };

  const isSelected = (music) => {
    return selectedMusic && selectedMusic.filename === music.filename;
  };

  const playMusic = (music, event) => {
    event.stopPropagation();
    
    if (playingMusic === music.filename) {
      // Pause current
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingMusic(null);
      }
    } else {
      // Play new music
      if (audioRef.current) {
        audioRef.current.src = `${BACKEND_URL}/music-library/${music.filename}`;
        audioRef.current.play();
        setPlayingMusic(music.filename);
      }
    }
  };

  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingMusic(null);
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

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|aac|flac)$/i)) {
      setError('Invalid file type. Please upload MP3, WAV, OGG, AAC, or FLAC files.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      const formData = new FormData();
      formData.append('music', file);

      await axios.post(`${API_BASE_URL}/music-library/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      setUploading(false);
      setUploadProgress(0);
      await refreshMusic();
    } catch (err) {
      setError('Failed to upload music: ' + (err.response?.data?.error || err.message));
      setUploading(false);
      setUploadProgress(0);
    }

    // Reset file input
    event.target.value = '';
  };

  const handleDelete = async (music, event) => {
    event.stopPropagation();
    
    if (!window.confirm(`Delete "${music.title}"?`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/music-library/${encodeURIComponent(music.filename)}`);
      await refreshMusic();
      
      // If deleted music was selected, clear selection
      if (isSelected(music)) {
        onSelectionChange(null);
      }
      
      // Stop playing if deleted music was playing
      if (playingMusic === music.filename) {
        stopMusic();
      }
    } catch (err) {
      setError('Failed to delete music: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
        <span className="ml-3 text-gray-600">Loading music library...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <X className="text-red-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-red-800 font-semibold mb-1">Error Loading Music</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadMusic}
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
      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingMusic(null)}
      />

      {/* Stats Bar */}
      {stats && stats.totalMusic > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-purple-600 font-semibold">Total Music</div>
              <div className="text-purple-900 text-lg">{stats.totalMusic}</div>
            </div>
            <div>
              <div className="text-purple-600 font-semibold">Total Duration</div>
              <div className="text-purple-900 text-lg">{formatDuration(stats.totalDuration)}</div>
            </div>
            <div>
              <div className="text-purple-600 font-semibold">Total Size</div>
              <div className="text-purple-900 text-lg">{formatFileSize(stats.totalSize)}</div>
            </div>
            <div>
              <div className="text-purple-600 font-semibold">Avg Duration</div>
              <div className="text-purple-900 text-lg">{formatDuration(stats.averageDuration)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uploading music...</span>
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

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition cursor-pointer">
            <Upload size={16} />
            Upload Music
            <input
              type="file"
              accept=".mp3,.wav,.ogg,.aac,.flac,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/flac"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          
          <button
            onClick={refreshMusic}
            disabled={loading || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Search and Sort */}
        <div className="flex gap-2 flex-1 md:flex-initial">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search music..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="duration">Sort by Duration</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>
      </div>

      {/* No Music Option */}
      {allowNoMusic && (
        <div
          onClick={handleNoMusic}
          className={`border-2 rounded-lg p-4 cursor-pointer transition ${
            !selectedMusic
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              !selectedMusic ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
            }`}>
              {!selectedMusic && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <span className="font-medium text-gray-800">No Background Music</span>
          </div>
        </div>
      )}

      {/* Music List */}
      {filteredMusic.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Music className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-gray-700 font-semibold mb-1">
            {searchTerm ? 'No music matches your search' : 'No music in library'}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? 'Try a different search term' : 'Upload music files to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMusic.map((music) => (
            <div
              key={music.filename}
              onClick={() => handleSelection(music)}
              className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                isSelected(music)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Radio Button */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected(music) ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                }`}>
                  {isSelected(music) && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>

                {/* Play Button */}
                <button
                  onClick={(e) => playMusic(music, e)}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition"
                >
                  {playingMusic === music.filename ? (
                    <Pause className="text-purple-600" size={20} />
                  ) : (
                    <Play className="text-purple-600 ml-0.5" size={20} />
                  )}
                </button>

                {/* Music Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{music.title}</div>
                  <div className="text-sm text-gray-600 truncate">{music.artist}</div>
                </div>

                {/* Metadata */}
                <div className="flex gap-4 items-center text-sm text-gray-600">
                  <span>{formatDuration(music.duration)}</span>
                  <span className="uppercase">{music.format}</span>
                  <span>{formatFileSize(music.size)}</span>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(music, e)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MusicLibraryBrowser;

