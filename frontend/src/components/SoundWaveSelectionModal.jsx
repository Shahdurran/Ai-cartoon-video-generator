import { useState, useEffect } from 'react';
import { X, Grid3x3, Sliders, Droplet, Activity } from 'lucide-react';
import SoundWaveLibraryBrowser from './SoundWaveLibraryBrowser';

const SoundWaveSelectionModal = ({ onClose, onConfirm, initialSettings = null }) => {
  const [selectedWave, setSelectedWave] = useState(initialSettings?.wave || null);
  const [settings, setSettings] = useState({
    position: initialSettings?.position || 'bottom-center',
    scale: initialSettings?.scale || 30,
    opacity: initialSettings?.opacity || 100,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showWaveBrowser, setShowWaveBrowser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch full wave metadata if initial wave is missing metadata
  useEffect(() => {
    const fetchWaveMetadata = async () => {
      if (selectedWave && selectedWave.filename && !selectedWave.format) {
        // Wave exists but missing metadata - fetch from server
        setLoading(true);
        try {
          const response = await fetch('http://localhost:3000/api/v2/sound-waves/library');
          const data = await response.json();
          
          if (data.success) {
            const fullWave = data.waves.find(w => w.filename === selectedWave.filename);
            if (fullWave) {
              setSelectedWave(fullWave);
            }
          }
        } catch (error) {
          console.error('Error fetching wave metadata:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchWaveMetadata();
  }, []);

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

  const handleSelectWave = (wave) => {
    setSelectedWave(wave);
    setShowWaveBrowser(false);
  };

  const handleUpdateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!selectedWave) {
      alert('Please select a sound wave');
      return;
    }

    onConfirm({
      wave: selectedWave,
      ...settings,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-7 h-7" />
              Select Sound Wave Overlay
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Choose a sound wave animation and configure overlay settings
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Wave Selection */}
            <div className="lg:col-span-2">
              <h3 className="font-semibold text-gray-800 mb-3">Select Sound Wave</h3>
              <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-600">Loading wave metadata...</p>
                  </div>
                ) : selectedWave ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        {selectedWave.thumbnail ? (
                          <img
                            src={`http://localhost:3000${selectedWave.thumbnail}`}
                            alt={selectedWave.filename}
                            className="w-24 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No thumb</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 mb-1">{selectedWave.filename}</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {selectedWave.width && selectedWave.height && (
                            <div>{selectedWave.width}x{selectedWave.height}</div>
                          )}
                          {selectedWave.isGif ? (
                            <div className="text-purple-600 font-medium">GIF • Loops ∞</div>
                          ) : selectedWave.duration && selectedWave.format && (
                            <div>{selectedWave.duration.toFixed(1)}s • {selectedWave.format.toUpperCase()}</div>
                          )}
                        </div>
                      </div>

                      {/* Change Button */}
                      <button
                        onClick={() => setShowWaveBrowser(true)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-3">No sound wave selected</p>
                    <button
                      onClick={() => setShowWaveBrowser(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Browse Sound Waves
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Settings */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Overlay Settings
              </h3>

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
                        onClick={() => handleUpdateSetting('position', pos.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          settings.position === pos.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 bg-white'
                        }`}
                        title={pos.label}
                      >
                        <div className="w-full aspect-square bg-gray-200 rounded relative">
                          <div
                            className={`absolute w-2 h-2 rounded-full transition-colors ${
                              settings.position === pos.value ? 'bg-blue-500' : 'bg-gray-400'
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
                    {positions.find(p => p.value === settings.position)?.label}
                  </p>
                </div>

                {/* Scale */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scale: {settings.scale}% of video width
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.scale}
                    onChange={(e) => handleUpdateSetting('scale', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Droplet className="w-4 h-4" />
                    Opacity: {settings.opacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.opacity}
                    onChange={(e) => handleUpdateSetting('opacity', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Preview Toggle */}
                {selectedWave && (
                  <div className="border-t border-gray-200 pt-4">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {showPreview && selectedWave && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-800 mb-3">Preview</h3>
              <div 
                className="bg-gray-900 rounded-lg p-4 flex items-center justify-center"
                style={{
                  minHeight: '300px',
                }}
              >
                {selectedWave.isGif ? (
                  <img
                    src={`http://localhost:3000/sound-waves/${selectedWave.filename}`}
                    alt="Sound wave preview"
                    className="rounded-lg shadow-lg"
                    style={{
                      maxWidth: `${settings.scale}%`,
                      opacity: settings.opacity / 100,
                    }}
                  />
                ) : (
                  <video
                    src={`http://localhost:3000/sound-waves/${selectedWave.filename}`}
                    loop
                    autoPlay
                    muted
                    className="rounded-lg shadow-lg"
                    style={{
                      maxWidth: `${settings.scale}%`,
                      opacity: settings.opacity / 100,
                    }}
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Preview showing scale and opacity settings
              </p>
            </div>
          )}
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
            disabled={!selectedWave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            Confirm Selection
          </button>
        </div>
      </div>

      {/* Wave Browser Modal */}
      {showWaveBrowser && (
        <SoundWaveLibraryBrowser
          onClose={() => setShowWaveBrowser(false)}
          onSelect={handleSelectWave}
          selectionMode={true}
          selectedWave={selectedWave}
        />
      )}
    </div>
  );
};

export default SoundWaveSelectionModal;

