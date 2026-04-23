import { useState } from 'react';
import { Film, Download, X } from 'lucide-react';

const VideoPreview = ({ videoUrl, title, onClose }) => {
  const [error, setError] = useState(false);

  if (!videoUrl) {
    return null;
  }

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = title ? `${title}.mp4` : 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Film className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">
              {title || 'Video Preview'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!error ? (
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                controls
                className="w-full"
                onError={() => setError(true)}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-600">Failed to load video</p>
              <p className="text-sm text-red-500 mt-2">{videoUrl}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              <Download size={20} />
              Download Video
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;

