import { useState, useEffect, useRef } from 'react';
import { X, Upload, Play, XCircle, Info, Loader2, RefreshCw } from 'lucide-react';
import { voiceCloneAPI } from '../services/api';

const VoiceCloneModal = ({ onClose, onSelect, initialSelection = null }) => {
  const [voiceClones, setVoiceClones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Upload form state
  const [uploadFile, setUploadFile] = useState(null);
  const [voiceName, setVoiceName] = useState('');
  const [language, setLanguage] = useState('Vietnamese');
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const languages = [
    'Vietnamese',
    'English',
    'Chinese',
    'Japanese',
    'Korean',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
  ];

  useEffect(() => {
    loadVoiceClones();
  }, []);

  const loadVoiceClones = async (syncWithAPI = false) => {
    try {
      setLoading(true);
      setError(null);
      console.log(syncWithAPI ? '🔄 Syncing voice clones with API...' : '🔄 Loading voice clones from storage...');
      const response = await voiceCloneAPI.list(syncWithAPI);
      console.log('✅ Voice clones loaded:', response);
      const clones = response.voiceClones || [];
      console.log(`   Found ${clones.length} voice clones${response.synced ? ' (synced with API)' : ' (from storage)'}`);
      setVoiceClones(clones);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError('Failed to load voice clones: ' + errorMessage);
      console.error('❌ Error loading voice clones:', err);
      console.error('   Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (20MB max)
      if (file.size > 20 * 1024 * 1024) {
        setError('File size must be less than 20MB');
        return;
      }

      // Validate file type
      const allowedExtensions = ['.wav', '.mp3', '.mpeg', '.mp4', '.m4a', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        setError(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
        return;
      }

      setUploadFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const allowedExtensions = ['.wav', '.mp3', '.mpeg', '.mp4', '.m4a', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      
      if (file.size > 20 * 1024 * 1024) {
        setError('File size must be less than 20MB');
        return;
      }
      
      if (!allowedExtensions.includes(ext)) {
        setError(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
        return;
      }

      setUploadFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !voiceName.trim()) {
      setError('Please select a file and enter a voice name');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('audio_file', uploadFile);
      formData.append('voice_name', voiceName.trim());
      formData.append('language_tag', language);
      formData.append('need_noise_reduction', noiseReduction);
      
      // Always include preview text (use default if not provided)
      const defaultPreviewText = "Hello, I'm delighted to assist you with our voice services. Choose a voice that resonates with you, and let's begin our creative audio journey together";
      formData.append('preview_text', previewText.trim() || defaultPreviewText);

      const response = await voiceCloneAPI.create(formData, (progress) => {
        setUploadProgress(progress);
      });

      if (response.success && response.voiceClone) {
        console.log('✅ Voice clone created successfully:', response.voiceClone);
        
        // Reload voice clones (now reads from local storage, no delay needed)
        await loadVoiceClones();
        
        // Reset form
        setUploadFile(null);
        setVoiceName('');
        setPreviewText('');
        setNoiseReduction(false);
        setShowUploadForm(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Don't close modal or show alert - let user see and hear the result
        // The newly created clone will appear in the list below with audio player
        console.log('🎉 Voice clone is now available in the list below');
      }
    } catch (err) {
      setError('Failed to create voice clone: ' + (err.response?.data?.error || err.message));
      console.error('Error creating voice clone:', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSelectClone = (clone) => {
    console.log('🎭 Selected voice clone:', clone);
    if (onSelect) {
      onSelect(clone);
    }
  };

  const getVoiceStatusBadge = (status) => {
    const statusMap = {
      0: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      1: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
      2: { label: 'Ready', color: 'bg-green-100 text-green-800' },
      3: { label: 'Failed', color: 'bg-red-100 text-red-800' },
    };
    const statusInfo = statusMap[status] || statusMap[0];
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getRemainingSlots = () => {
    const limit = 30; // As per API docs
    const used = voiceClones.length;
    return limit - used;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Voice Clones</h2>
            <span className="text-sm text-gray-600">
              Voice slots remaining: {getRemainingSlots()}/30
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Upload Section */}
          <div className="border-b border-gray-200 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Create New Voice Clone</h3>
              <button
                onClick={() => {
                  setShowUploadForm(!showUploadForm);
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showUploadForm ? 'Hide Upload Form' : 'Show Upload Form'}
              </button>
            </div>

            {showUploadForm && (
              <div className="space-y-4">
                {/* File Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    uploadFile
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {uploadFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Upload className="text-blue-600" size={20} />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-800">{uploadFile.name}</div>
                          <div className="text-sm text-gray-600">
                            {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setUploadFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle size={20} />
                        </button>
                      </div>
                      {audioRef.current && (
                        <audio
                          ref={audioRef}
                          src={URL.createObjectURL(uploadFile)}
                          controls
                          className="w-full"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="mx-auto text-gray-400" size={48} />
                      <div>
                        <p className="text-gray-700 font-medium">Drag and drop file here</p>
                        <p className="text-gray-500 text-sm mt-1">or</p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Select file
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".wav,.mp3,.mpeg,.mp4,.m4a,.avi,.mov,.wmv,.flv,.mkv,.webm"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Supported formats: .wav, .mp3, .mpeg, .mp4, .m4a, .avi, .mov, .wmv, .flv, .mkv, .webm
                      </p>
                      <p className="text-xs text-gray-500">
                        max 20MB, min 10 seconds and 300 seconds (5 minutes)
                      </p>
                    </div>
                  )}
                </div>

                {/* Voice Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voice Name *
                  </label>
                  <input
                    type="text"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter voice name"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Noise Reduction */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="noiseReduction"
                    checked={noiseReduction}
                    onChange={(e) => setNoiseReduction(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="noiseReduction" className="text-sm text-gray-700">
                    Noise Reduction
                  </label>
                  <button
                    onClick={() => alert('Noise reduction helps remove background noise from the audio sample, resulting in a cleaner voice clone.')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Info size={16} />
                  </button>
                </div>

                {/* Preview Text (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preview Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Preview text for the voice clone"
                  />
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !voiceName.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Uploading... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      <span>Create Voice Clone</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Voice Clones List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Your Voice Clones</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => loadVoiceClones(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  title="Sync with genAi pro API"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Sync with API
                </button>
                <button
                  onClick={() => loadVoiceClones(false)}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  title="Reload from local storage"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            ) : voiceClones.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No voice clones created yet.</p>
                <p className="text-sm mt-2">Upload an audio file above to create your first voice clone.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voiceClones.map((clone) => (
                  <div
                    key={clone.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      initialSelection?.id === clone.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectClone(clone)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{clone.voice_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {getVoiceStatusBadge(clone.voice_status)}
                          {clone.tag_list && clone.tag_list.length > 0 && (
                            <span className="text-xs text-gray-600">
                              {clone.tag_list.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {initialSelection?.id === clone.id && (
                        <div className="text-blue-600 font-semibold">Selected</div>
                      )}
                    </div>
                    {clone.preview_text && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        "{clone.preview_text}"
                      </p>
                    )}
                    {clone.sample_audio && (
                      <div className="mt-3">
                        <audio
                          src={clone.sample_audio}
                          controls
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCloneModal;

