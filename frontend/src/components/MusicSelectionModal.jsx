import { X, FolderOpen } from 'lucide-react';
import MusicLibraryBrowser from './MusicLibraryBrowser';

const MusicSelectionModal = ({ isOpen, onClose, onSelect, currentSelection }) => {
  if (!isOpen) return null;

  const handleSelection = (music) => {
    onSelect(music);
    // Don't close automatically - let parent decide
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">Select Background Music</h2>
            <p className="text-sm text-gray-600 mt-1">Choose music to play in the background of your videos</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded border border-blue-200">
              <FolderOpen size={14} />
              <span>Upload folder: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">music-library/</code></span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors ml-4"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <MusicLibraryBrowser
            selectedMusic={currentSelection}
            onSelectionChange={handleSelection}
            allowNoMusic={true}
          />
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            {currentSelection ? (
              <>Selected: <span className="font-medium">{currentSelection.title}</span></>
            ) : (
              'No music selected'
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (currentSelection) {
                  onSelect(currentSelection);
                }
                onClose();
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicSelectionModal;

