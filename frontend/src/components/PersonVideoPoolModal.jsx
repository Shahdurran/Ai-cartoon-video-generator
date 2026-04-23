import { useState, useEffect } from 'react';
import { X, Plus, Trash2, User, Grid3x3, Sliders, Droplet, Palette } from 'lucide-react';
import PersonVideoLibraryBrowser from './PersonVideoLibraryBrowser';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const PersonVideoPoolModal = ({ onClose, onConfirm, initialPool = [] }) => {
  const [pool, setPool] = useState(initialPool);
  const [showVideoBrowser, setShowVideoBrowser] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentSettings, setCurrentSettings] = useState({
    position: 'bottom-right',
    scale: 50,
    opacity: 100,
    chromaKey: {
      enabled: false,
      color: '#00FF00',
      similarity: 30,
      blend: 10,
    },
  });

  const positions = [
    { value: 'top-left', label: 'Top Left', grid: [0, 0] },
    { value: 'top-center', label: 'Top Center', grid: [0, 1] },
    { value: 'top-right', label: 'Top Right', grid: [0, 2] },
    { value: 'center-left', label: 'Center Left', grid: [1, 0] },
    { value: 'center', label: 'Center', grid: [1, 1] },
    { value: 'center-right', label: 'Center Right', grid: [1, 2] },
    { value: 'bottom-left', label: 'Bottom Left', grid: [2, 0] },
    { value: 'bottom-center', label: 'Bottom Center', grid: [2, 1] },
    { value: 'bottom-right', label: 'Bottom Right', grid: [2, 2] },
  ];

  const handleSelectVideo = (video) => {
    // Add video to pool with default settings
    const newVideo = {
      ...video,
      position: 'bottom-right',
      scale: 50,
      opacity: 100,
      chromaKey: {
        enabled: false,
        color: '#00FF00',
        similarity: 30,
        blend: 10,
      },
    };

    setPool([...pool, newVideo]);
    // Don't close the browser - allow multiple selections
  };

  const handleSaveSettings = () => {
    // Save settings for the video being edited
    if (editingIndex !== null && pool[editingIndex]) {
      const existingVideo = pool[editingIndex];
      const updatedVideo = {
        ...existingVideo,
        position: currentSettings.position,
        scale: currentSettings.scale,
        opacity: currentSettings.opacity,
        chromaKey: currentSettings.chromaKey,
      };

      const newPool = [...pool];
      newPool[editingIndex] = updatedVideo;
      setPool(newPool);
      setEditingIndex(null);
      
      // Reset settings
      setCurrentSettings({
        position: 'bottom-right',
        scale: 50,
        opacity: 100,
        chromaKey: {
          enabled: false,
          color: '#00FF00',
          similarity: 30,
          blend: 10,
        },
      });

      setShowEditSettings(false);
    }
  };

  const handleRemoveVideo = (index) => {
    setPool(pool.filter((_, i) => i !== index));
  };

  const handleEditVideo = (index) => {
    const video = pool[index];
    setCurrentSettings({
      position: video.position || 'bottom-right',
      scale: video.scale || 50,
      opacity: video.opacity || 100,
      chromaKey: video.chromaKey || {
        enabled: false,
        color: '#00FF00',
        similarity: 30,
        blend: 10,
      },
    });
    setEditingIndex(index);
    setShowEditSettings(true);
  };

  const handleAddNew = () => {
    setShowVideoBrowser(true);
  };
  
  const handleCloseVideoBrowser = () => {
    setShowVideoBrowser(false);
  };

  const handleUpdateSetting = (key, value) => {
    setCurrentSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleUpdateChromaKey = (key, value) => {
    setCurrentSettings(prev => ({
      ...prev,
      chromaKey: {
        ...prev.chromaKey,
        [key]: value,
      },
    }));
  };

  const handleConfirm = () => {
    onConfirm(pool);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Person Video Pool</h2>
            <p className="text-gray-600 text-sm mt-1">
              Add multiple person videos that will be randomly selected for each batch video
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">
                Person Videos in Pool ({pool.length})
              </h3>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Video
              </button>
            </div>

            {pool.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pool.map((video, index) => (
                  <div key={video.filename + index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {/* Video Preview */}
                    <div className="relative aspect-video bg-gray-900 rounded overflow-hidden mb-3">
                      <video
                        src={`${BACKEND_URL}/person-videos/${video.filename}`}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                      />
                      <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="mb-3">
                      <div className="font-medium text-gray-800 text-sm mb-2 truncate" title={video.filename}>
                        {video.filename}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          {video.position?.replace('-', ' ') || 'bottom-right'}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          {video.scale || 50}%
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          {video.opacity || 100}% opacity
                        </span>
                        {video.chromaKey?.enabled && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Chroma Key
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditVideo(index)}
                        className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveVideo(index)}
                        className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No person videos in pool</p>
                <p className="text-sm text-gray-500 mb-4">
                  Add multiple person videos to create variety in batch generations.
                  <br />
                  Each video will be randomly selected per video in the batch.
                </p>
                <button
                  onClick={handleAddNew}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Add First Video
                </button>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
              <span>🎲</span>
              How Random Selection Works
            </h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• Each video in a batch will randomly pick one person overlay from this pool</li>
              <li>• All overlay settings (position, scale, opacity, chroma key) are preserved per video</li>
              <li>• The same person video can appear in multiple videos (random with replacement)</li>
              <li>• Perfect for creating variety while maintaining consistent branding</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            Save Pool ({pool.length} videos)
          </button>
        </div>
      </div>

      {/* Video Browser Modal - For Adding Videos */}
      {showVideoBrowser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={handleCloseVideoBrowser}>
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Add Person Videos to Pool
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  Select multiple person videos. You can edit their settings later.
                </p>
              </div>
              <button
                onClick={handleCloseVideoBrowser}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content - Just the video browser */}
            <div className="flex-1 overflow-y-auto p-6">
              <PersonVideoLibraryBrowser
                onSelect={handleSelectVideo}
                selectionMode={true}
                showHeader={false}
              />
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {pool.length} video{pool.length !== 1 ? 's' : ''} in pool
                </p>
                <button
                  onClick={handleCloseVideoBrowser}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Done Adding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Settings Modal - For Editing Overlay Settings */}
      {showEditSettings && editingIndex !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setShowEditSettings(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Edit Overlay Settings for Video #{editingIndex + 1}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {pool[editingIndex]?.filename}
                </p>
              </div>
              <button
                onClick={() => setShowEditSettings(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content - Just the settings */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                    {/* Position */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Grid3x3 className="w-4 h-4" />
                        Position
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {positions.map((pos) => (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => handleUpdateSetting('position', pos.value)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              currentSettings.position === pos.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400 bg-white'
                            }`}
                            title={pos.label}
                          >
                            <div className="w-full aspect-square bg-gray-200 rounded relative">
                              <div
                                className={`absolute w-2 h-2 rounded-full transition-colors ${
                                  currentSettings.position === pos.value ? 'bg-blue-500' : 'bg-gray-400'
                                }`}
                                style={{
                                  top: pos.grid[0] === 0 ? '2px' : pos.grid[0] === 1 ? 'calc(50% - 4px)' : 'calc(100% - 10px)',
                                  left: pos.grid[1] === 0 ? '2px' : pos.grid[1] === 1 ? 'calc(50% - 4px)' : 'calc(100% - 10px)',
                                }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {positions.find(p => p.value === currentSettings.position)?.label}
                      </p>
                    </div>

                    {/* Scale */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Scale: {currentSettings.scale}%
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={currentSettings.scale}
                        onChange={(e) => handleUpdateSetting('scale', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>20%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Droplet className="w-4 h-4" />
                        Opacity: {currentSettings.opacity}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentSettings.opacity}
                        onChange={(e) => handleUpdateSetting('opacity', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Chroma Key (Green Screen) */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="chromaKeyEnabledPool"
                          checked={currentSettings.chromaKey.enabled}
                          onChange={(e) => handleUpdateChromaKey('enabled', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="chromaKeyEnabledPool" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Remove Green Screen
                        </label>
                      </div>

                      {currentSettings.chromaKey.enabled && (
                        <div className="space-y-3 ml-6">
                          {/* Color */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Key Color
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={currentSettings.chromaKey.color}
                                onChange={(e) => handleUpdateChromaKey('color', e.target.value)}
                                className="w-12 h-8 rounded border border-gray-300"
                              />
                              <input
                                type="text"
                                value={currentSettings.chromaKey.color}
                                onChange={(e) => handleUpdateChromaKey('color', e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                          </div>

                          {/* Similarity */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Similarity: {currentSettings.chromaKey.similarity}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={currentSettings.chromaKey.similarity}
                              onChange={(e) => handleUpdateChromaKey('similarity', parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>

                          {/* Blend */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Edge Blend: {currentSettings.chromaKey.blend}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={currentSettings.chromaKey.blend}
                              onChange={(e) => handleUpdateChromaKey('blend', parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEditSettings(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonVideoPoolModal;

