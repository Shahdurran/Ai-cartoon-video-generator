import { useState } from 'react';
import { X, Check, Video as VideoIcon, GripVertical } from 'lucide-react';
import VideoBankBrowser from './VideoBankBrowser';

const VideoSelectionModal = ({ initialSelection = [], onClose, onConfirm }) => {
  const [selectedVideos, setSelectedVideos] = useState(initialSelection);

  const handleConfirm = () => {
    onConfirm(selectedVideos);
    onClose();
  };

  const removeVideo = (filename) => {
    setSelectedVideos(selectedVideos.filter(v => v.filename !== filename));
  };

  const moveVideo = (fromIndex, toIndex) => {
    const newVideos = [...selectedVideos];
    const [removed] = newVideos.splice(fromIndex, 1);
    newVideos.splice(toIndex, 0, removed);
    setSelectedVideos(newVideos);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Select Background Videos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose videos from your video bank to use as background footage
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <VideoBankBrowser
            selectedVideos={selectedVideos}
            onSelectionChange={setSelectedVideos}
            selectionMode={true}
          />
        </div>

        {/* Selected Videos Preview */}
        {selectedVideos.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Selected Videos ({selectedVideos.length})
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {selectedVideos.map((video, index) => (
                <div
                  key={video.filename}
                  className="relative flex-shrink-0 group"
                >
                  {/* Drag Handle */}
                  <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition cursor-move">
                    <GripVertical size={16} className="text-gray-400" />
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-32 h-18 bg-gray-900 rounded overflow-hidden">
                    {video.thumbnail ? (
                      <img
                        src={`http://localhost:3000${video.thumbnail}`}
                        alt={video.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <VideoIcon className="text-gray-600" size={24} />
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={() => removeVideo(video.filename)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
                    >
                      <X size={12} />
                    </button>

                    {/* Duration */}
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </div>

                    {/* Index */}
                    <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Filename */}
                  <div className="mt-1 text-xs text-gray-600 text-center truncate w-32" title={video.filename}>
                    {video.filename}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: Videos will be used in this order. Drag to reorder (coming soon).
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <div className="text-sm text-gray-600">
            {selectedVideos.length === 0 ? (
              'No videos selected'
            ) : (
              `${selectedVideos.length} video${selectedVideos.length !== 1 ? 's' : ''} selected`
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedVideos.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSelectionModal;

