import { useState, useEffect } from 'react';
import { X, Upload, Trash2, RefreshCw, AlertCircle, Activity } from 'lucide-react';

const SoundWaveLibraryBrowser = ({ onClose, onSelect, selectionMode = false, selectedWave = null }) => {
  const [waves, setWaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadWaves();
    loadStats();
  }, []);

  const loadWaves = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/v2/sound-waves/library');
      const data = await response.json();
      
      if (data.success) {
        setWaves(data.waves);
      } else {
        setError('Failed to load sound waves');
      }
    } catch (err) {
      console.error('Error loading sound waves:', err);
      setError('Failed to load sound waves');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v2/sound-waves/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.gif', '.mp4', '.mov', '.webm'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('soundWave', file);

      const response = await fetch('http://localhost:3000/api/v2/sound-waves/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        await loadWaves();
        await loadStats();
        setError(null);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v2/sound-waves/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await loadWaves();
        await loadStats();
      } else {
        setError(data.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Delete failed: ' + err.message);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/v2/sound-waves/refresh', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setWaves(data.waves);
        await loadStats();
      }
    } catch (err) {
      console.error('Refresh error:', err);
      setError('Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWave = (wave) => {
    if (selectionMode && onSelect) {
      onSelect(wave);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-7 h-7" />
              Sound Wave Library
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Upload and manage sound wave animations (GIF, MP4, WebM, MOV)
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
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">
                  <strong>{stats.totalWaves}</strong> wave{stats.totalWaves !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-700">
                  <strong>{stats.totalSize}</strong> total
                </span>
                {stats.gifCount > 0 && (
                  <span className="text-gray-700">
                    <strong>{stats.gifCount}</strong> GIF{stats.gifCount !== 1 ? 's' : ''}
                  </span>
                )}
                {stats.videoCount > 0 && (
                  <span className="text-gray-700">
                    <strong>{stats.videoCount}</strong> video{stats.videoCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="border-b border-gray-200 px-6 py-4">
          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Sound Wave'}
            <input
              type="file"
              accept=".gif,.mp4,.mov,.webm"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Supported formats: GIF, MP4, MOV, WebM • Max size: 50MB
          </p>
        </div>

        {/* Wave Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading sound waves...</span>
            </div>
          ) : waves.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No sound waves uploaded yet</p>
              <p className="text-sm text-gray-500">Upload animated sound waves to use as overlays</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {waves.map((wave) => (
                <div
                  key={wave.filename}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    selectionMode
                      ? selectedWave?.filename === wave.filename
                        ? 'border-blue-500 ring-2 ring-blue-200 cursor-pointer'
                        : 'border-gray-200 hover:border-blue-400 cursor-pointer'
                      : 'border-gray-200'
                  }`}
                  onClick={() => handleSelectWave(wave)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900">
                    {wave.thumbnail ? (
                      <img
                        src={`http://localhost:3000${wave.thumbnail}`}
                        alt={wave.filename}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Activity className="text-gray-600" size={32} />
                      </div>
                    )}
                    {wave.isGif && (
                      <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                        GIF
                      </span>
                    )}
                    {!selectionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(wave.filename);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-white">
                    <div className="font-medium text-sm text-gray-800 mb-1 truncate" title={wave.filename}>
                      {wave.filename}
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      {wave.width && wave.height && (
                        <div>{wave.width}×{wave.height}</div>
                      )}
                      {wave.duration && (
                        <div>{wave.duration.toFixed(1)}s</div>
                      )}
                      <div className="text-gray-500">{wave.fileSizeFormatted}</div>
                    </div>
                    {wave.isGif && (
                      <div className="mt-2 text-xs text-purple-600 font-medium">
                        ∞ Loops indefinitely
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectionMode && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoundWaveLibraryBrowser;

