import { useState, useEffect, useRef } from 'react';
import { Video, Clock, FileText, Mic, Image, CheckCircle, AlertCircle, RefreshCw, Play, Pause, Loader, History } from 'lucide-react';
import { channelAPI, videoAPI } from '../services/api';
import SessionHistoryModal from './SessionHistoryModal';

const StepByStepVideoGenerator = ({ selectedChannel }) => {
  const [channels, setChannels] = useState([]);
  const [step, setStep] = useState(() => {
    // Restore step from localStorage
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).step : 1;
  });
  const [sessionId, setSessionId] = useState(() => {
    // Restore sessionId from localStorage
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).sessionId : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);

  // Step 1: Configuration
  const [config, setConfig] = useState({
    channelId: selectedChannel?.id || '',
    title: '',
    context: '',
    customPrompt: '',
    targetDuration: 90, // seconds
    targetDurationPreset: 'medium', // short, medium, long, custom
  });

  // Step 2: Script
  const [scriptData, setScriptData] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).scriptData : null;
  });
  const [editedScript, setEditedScript] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).editedScript : '';
  });

  // Step 3: Voice
  const [voiceData, setVoiceData] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).voiceData : null;
  });

  // Step 4: Images
  const [imagesData, setImagesData] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).imagesData : null;
  });

  // Step 5: Final video
  const [finalVideoJobId, setFinalVideoJobId] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).finalVideoJobId : null;
  });
  const [finalVideoStatus, setFinalVideoStatus] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).finalVideoStatus : null;
  });
  const [finalVideoResult, setFinalVideoResult] = useState(() => {
    const saved = localStorage.getItem('stepByStepState');
    return saved ? JSON.parse(saved).finalVideoResult : null;
  });

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      setConfig(prev => ({ ...prev, channelId: selectedChannel.id }));
    }
  }, [selectedChannel]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      step,
      sessionId,
      scriptData,
      editedScript,
      voiceData,
      imagesData,
      finalVideoJobId,
      finalVideoStatus,
      finalVideoResult,
    };
    localStorage.setItem('stepByStepState', JSON.stringify(stateToSave));
  }, [step, sessionId, scriptData, editedScript, voiceData, imagesData, finalVideoJobId, finalVideoStatus, finalVideoResult]);

  // Poll job status when video is queued
  useEffect(() => {
    if (!finalVideoJobId || finalVideoStatus === 'completed' || finalVideoStatus === 'failed') {
      return;
    }

    const pollJobStatus = async () => {
      try {
        // First, try to get the specific job from videoProcessing queue
        try {
          const jobData = await videoAPI.getJobStatus(finalVideoJobId, 'videoProcessing');
          
          if (jobData && jobData.job) {
            const job = jobData.job;
            const jobState = job.state || job.status;
            
            console.log(`📊 Job ${finalVideoJobId} status:`, jobState, job);
            
            setFinalVideoStatus(jobState);
            
            if (jobState === 'completed' && job.returnvalue) {
              console.log('✅ Video completed, result:', job.returnvalue);
              setFinalVideoResult(job.returnvalue);
              setError(null); // Clear any previous errors
            } else if (jobState === 'failed') {
              console.error('❌ Video generation failed:', job.failedReason);
              setError(`Video generation failed: ${job.failedReason || 'Unknown error'}`);
            }
            
            return; // Successfully got job status, no need to search all queues
          }
        } catch (specificJobError) {
          console.log(`⚠️  Job ${finalVideoJobId} not found in videoProcessing queue, searching all queues...`);
        }
        
        // Fallback: Search for job in all queues (if specific queue lookup failed)
        const data = await videoAPI.getQueue();
        
        let foundJob = null;
        if (data.queues && typeof data.queues === 'object') {
          Object.values(data.queues).forEach(queue => {
            if (queue.jobs && typeof queue.jobs === 'object') {
              // Check in all status arrays (waiting, active, completed, failed)
              Object.values(queue.jobs).forEach(jobsArray => {
                if (Array.isArray(jobsArray)) {
                  const job = jobsArray.find(j => j.id === String(finalVideoJobId));
                  if (job && !foundJob) { // Only use first match
                    foundJob = job;
                  }
                }
              });
            }
          });
        }

        if (foundJob) {
          const jobState = foundJob.state || foundJob.status;
          console.log(`📊 Job ${finalVideoJobId} found in queue search:`, jobState);
          
          setFinalVideoStatus(jobState);
          
          if (jobState === 'completed' && foundJob.returnvalue) {
            console.log('✅ Video completed, result:', foundJob.returnvalue);
            setFinalVideoResult(foundJob.returnvalue);
            setError(null); // Clear any previous errors
          } else if (jobState === 'failed') {
            console.error('❌ Video generation failed:', foundJob.failedReason);
            setError(`Video generation failed: ${foundJob.failedReason || 'Unknown error'}`);
          }
        } else {
          console.warn(`⚠️  Job ${finalVideoJobId} not found in any queue`);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };

    // Poll immediately and then every 3 seconds
    pollJobStatus();
    const interval = setInterval(pollJobStatus, 3000);
    
    return () => clearInterval(interval);
  }, [finalVideoJobId, finalVideoStatus]);

  const loadChannels = async () => {
    try {
      const data = await channelAPI.getAll();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const getSelectedChannel = () => {
    return channels.find(ch => ch.id === config.channelId);
  };

  // Duration presets in seconds
  const durationPresets = {
    short: { min: 30, max: 120, default: 60, label: 'Short (30s-2min)' },
    medium: { min: 120, max: 600, default: 300, label: 'Medium (2-10min)' },
    long: { min: 600, max: 1800, default: 900, label: 'Long (10-30min)' },
    verylong: { min: 1800, max: 3600, default: 2700, label: 'Very Long (30-60min)' },
  };

  const handleDurationPresetChange = (preset) => {
    setConfig({
      ...config,
      targetDurationPreset: preset,
      targetDuration: durationPresets[preset]?.default || 90,
    });
  };

  const calculateWordCount = (seconds) => {
    return Math.round(seconds * 2.5);
  };

  // STEP 1: Generate Script
  const handleGenerateScript = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await videoAPI.generateScript({
        title: config.title,
        context: config.context,
        customPrompt: config.customPrompt,
        targetDuration: config.targetDuration,
        channelId: config.channelId,
      });

      setSessionId(result.sessionId);
      setScriptData(result);
      setEditedScript(result.script);
      setStep(2);
      console.log('✅ Script generated:', result);
    } catch (err) {
      setError(`Script generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Generate Voice
  const handleGenerateVoice = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await videoAPI.generateVoice({
        sessionId,
        scriptOverride: editedScript !== scriptData.script ? editedScript : null,
        voiceSettings: {},
      });

      setVoiceData(result);
      setStep(3);
      console.log('✅ Voice generated:', result);
    } catch (err) {
      setError(`Voice generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Generate Images (only for TYPE_2)
  const handleGenerateImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const channel = getSelectedChannel();
      
      // TYPE_1 uses background videos, so skip image generation
      if (channel?.type === 'TYPE_1') {
        console.log('📹 TYPE_1 channel detected - skipping image generation, using background videos');
        setImagesData({ 
          skipped: true, 
          reason: 'TYPE_1 uses background videos',
          images: [] 
        });
        setStep(4);
        setLoading(false);
        return;
      }
      
      const imageStyle = channel?.visualSettings?.imageStyle || 'cinematic';
      
      // Calculate number of images based on video duration
      // Rule: 1 image per 15-20 seconds for shorter videos, 1 per 30-45s for longer videos
      const audioDuration = voiceData.duration || config.targetDuration;
      let numberOfImages;
      if (audioDuration <= 60) {
        numberOfImages = Math.ceil(audioDuration / 15); // 1 image per 15s for short videos
      } else if (audioDuration <= 300) {
        numberOfImages = Math.ceil(audioDuration / 20); // 1 image per 20s for medium videos
      } else if (audioDuration <= 900) {
        numberOfImages = Math.ceil(audioDuration / 30); // 1 image per 30s for longer videos
      } else {
        numberOfImages = Math.ceil(audioDuration / 45); // 1 image per 45s for very long videos
      }
      
      // Cap between 5 and 50 images
      numberOfImages = Math.max(5, Math.min(50, numberOfImages));
      
      console.log(`📊 Generating ${numberOfImages} images for ${audioDuration.toFixed(1)}s video`);

      const result = await videoAPI.generateImages({
        sessionId,
        numberOfImages,
        imageStyle: `${imageStyle}, realistic, high quality, detailed, professional`,
      });

      setImagesData(result);
      setStep(4);
      console.log('✅ Images generated:', result);
    } catch (err) {
      setError(`Image generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 4: Generate Final Video
  const handleGenerateFinal = async () => {
    setLoading(true);
    setError(null);

    try {
      const channel = getSelectedChannel();
      const result = await videoAPI.generateFinal({
        sessionId,
        channelId: config.channelId,
        channelConfig: channel || {},
      });

      setFinalVideoJobId(result.jobId);
      console.log('✅ Final video queued:', result);
    } catch (err) {
      setError(`Final video generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNew = () => {
    // Clear state and start over
    localStorage.removeItem('stepByStepState');
    setStep(1);
    setSessionId(null);
    setScriptData(null);
    setEditedScript('');
    setVoiceData(null);
    setImagesData(null);
    setFinalVideoJobId(null);
    setFinalVideoStatus(null);
    setFinalVideoResult(null);
    setError(null);
  };

  const handleLoadSession = (session) => {
    console.log('📖 Loading session:', session);
    
    // Set session ID
    setSessionId(session.sessionId);
    
    // Load script if available
    if (session.script) {
      setScriptData({
        sessionId: session.sessionId,
        script: session.script.script,
        sentences: session.script.sentences,
        wordCount: session.script.wordCount,
        estimatedDuration: session.script.estimatedDuration,
        metadata: session.script.metadata,
      });
      setEditedScript(session.script.script);
      
      // If we have a script, move to step 2
      setStep(2);
    }
    
    // Load voice if available
    if (session.voice) {
      setVoiceData({
        sessionId: session.sessionId,
        audioPath: session.voice.audioPath,
        duration: session.voice.duration,
        provider: session.voice.provider,
      });
      
      // If we have voice, move to step 3
      setStep(3);
    }
    
    // Load images if available
    if (session.images && session.images.length > 0) {
      setImagesData({
        sessionId: session.sessionId,
        images: session.images,
        successCount: session.images.length,
        totalCount: session.images.length,
        imageBlocks: session.images.map(img => img.block).filter(Boolean),
      });
      
      // If we have images, move to step 4
      setStep(4);
    }
    
    // Update config with session title
    setConfig(prev => ({
      ...prev,
      title: session.title,
      channelId: session.channelId || prev.channelId,
    }));
    
    setError(null);
    console.log('✅ Session loaded successfully');
  };

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (playingAudio) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlayingAudio(!playingAudio);
    }
  };

  // State for prompt editing
  const [editingPromptIndex, setEditingPromptIndex] = useState(null);
  const [editedPrompts, setEditedPrompts] = useState({});

  const regenerateImage = async (imageIndex, customPrompt = null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await videoAPI.regenerateAsset({
        sessionId,
        assetType: 'image',
        imageIndex,
        customPrompt,
      });

      // Update images data
      const updatedImages = [...imagesData.images];
      updatedImages[imageIndex] = result.newImage;
      setImagesData({ ...imagesData, images: updatedImages });
      
      // Clear edited prompt for this index
      const newEditedPrompts = { ...editedPrompts };
      delete newEditedPrompts[imageIndex];
      setEditedPrompts(newEditedPrompts);
      setEditingPromptIndex(null);
      
      console.log(`✅ Image ${imageIndex + 1} regenerated`);
    } catch (err) {
      setError(`Image regeneration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptEdit = (index, newPrompt) => {
    setEditedPrompts({ ...editedPrompts, [index]: newPrompt });
  };

  const getPromptForImage = (index) => {
    return editedPrompts[index] !== undefined 
      ? editedPrompts[index] 
      : imagesData.images[index]?.prompt || '';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Video className="text-blue-600" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Step-by-Step Video Generator</h2>
              <p className="text-sm text-gray-600">Preview and review each step before finalizing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sessionId && (
              <>
                <div className="text-xs text-gray-500 font-mono">
                  Session: {sessionId.substring(0, 20)}...
                </div>
                <button
                  onClick={handleStartNew}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Start New
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[
            { num: 1, label: 'Configure & Script', icon: FileText },
            { num: 2, label: 'Generate Voice', icon: Mic },
            { num: 3, label: getSelectedChannel()?.type === 'TYPE_1' ? 'Review Setup' : 'Generate Images', icon: getSelectedChannel()?.type === 'TYPE_1' ? Video : Image },
            { num: 4, label: 'Final Video', icon: Video },
          ].map((s) => {
            const StepIcon = s.icon;
            const isComplete = step > s.num;
            const isCurrent = step === s.num;
            
            return (
              <div key={s.num} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isComplete ? <CheckCircle size={24} /> : <StepIcon size={24} />}
                </div>
                <span className={`text-xs text-center ${isCurrent ? 'font-semibold' : ''}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* STEP 1: Configuration & Script Generation */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Step 1: Configure Your Video</h3>
              {config.channelId && (
                <button
                  type="button"
                  onClick={() => setShowSessionHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition text-sm"
                >
                  <History size={16} />
                  Load from Previous
                </button>
              )}
            </div>

            {/* Channel Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel *
              </label>
              <select
                required
                value={config.channelId}
                onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Duration */}
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="text-blue-600" size={20} />
                <label className="text-sm font-semibold text-gray-800">Target Video Duration</label>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {Object.entries(durationPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDurationPresetChange(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      config.targetDurationPreset === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Duration Slider */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-700">
                    Duration: {Math.floor(config.targetDuration / 60)}:{(config.targetDuration % 60).toString().padStart(2, '0')}
                    <span className="text-gray-500 ml-1">({config.targetDuration}s)</span>
                  </span>
                  <span className="text-blue-600 font-medium">
                    ~{calculateWordCount(config.targetDuration)} words
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="3600"
                  step="15"
                  value={config.targetDuration}
                  onChange={(e) => setConfig({ ...config, targetDuration: parseInt(e.target.value), targetDurationPreset: 'custom' })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>30s</span>
                  <span>60min</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Title *
              </label>
              <input
                type="text"
                required
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter video title"
              />
            </div>

            {/* Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context *
              </label>
              <textarea
                required
                value={config.context}
                onChange={(e) => setConfig({ ...config, context: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Provide context or topic for the video content"
              />
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Prompt (Optional)
              </label>
              <textarea
                value={config.customPrompt}
                onChange={(e) => setConfig({ ...config, customPrompt: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Add specific instructions for script generation"
              />
            </div>

            {/* Generate Script Button */}
            <button
              onClick={handleGenerateScript}
              disabled={loading || !config.channelId || !config.title || !config.context}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Generating Script...
                </>
              ) : (
                <>
                  <FileText size={20} />
                  Generate Script
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: Review Script & Generate Voice */}
        {step === 2 && scriptData && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Step 2: Review Script & Generate Voice</h3>

            {/* Script Metadata */}
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <div className="text-xs text-gray-600">Word Count</div>
                <div className="text-lg font-semibold text-gray-800">{scriptData.wordCount}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Sentences</div>
                <div className="text-lg font-semibold text-gray-800">{scriptData.sentences.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Est. Duration</div>
                <div className="text-lg font-semibold text-gray-800">{scriptData.estimatedDuration}s</div>
              </div>
            </div>

            {/* Editable Script */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated Script (Editable)
              </label>
              <textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                You can edit the script before generating voice narration
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                ← Back to Config
              </button>
              <button
                onClick={handleGenerateScript}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
              >
                <RefreshCw size={16} className="inline mr-2" />
                Regenerate Script
              </button>
              <button
                onClick={handleGenerateVoice}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Generating Voice...
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    Approve & Generate Voice
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review Voice & Generate Images */}
        {step === 3 && voiceData && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Step 3: Review Voice & Generate Images</h3>

            {/* Voice Metadata */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="text-green-600" size={24} />
                <div>
                  <div className="font-semibold text-gray-800">Voice Narration Generated</div>
                  <div className="text-sm text-gray-600">
                    Duration: {voiceData.duration?.toFixed(1)}s | Provider: {voiceData.provider}
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                <button
                  onClick={toggleAudioPlayback}
                  className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition"
                >
                  {playingAudio ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <audio
                  ref={audioRef}
                  src={`http://localhost:3000${voiceData.audioPath?.replace(/\\/g, '/').replace(/^.*temp/, '/temp')}`}
                  onEnded={() => setPlayingAudio(false)}
                  onPlay={() => setPlayingAudio(true)}
                  onPause={() => setPlayingAudio(false)}
                />
                <div className="flex-1">
                  <div className="text-sm text-gray-700 font-medium">Preview Voice Narration</div>
                  <div className="text-xs text-gray-500">Click play to listen</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                ← Back to Script
              </button>
              <button
                onClick={handleGenerateImages}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    {getSelectedChannel()?.type === 'TYPE_1' ? 'Processing...' : 'Generating Images...'}
                  </>
                ) : (
                  <>
                    {getSelectedChannel()?.type === 'TYPE_1' ? <Video size={20} /> : <Image size={20} />}
                    {getSelectedChannel()?.type === 'TYPE_1' ? 'Continue to Final Video' : 'Approve & Generate Images'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review Images & Generate Final Video */}
        {step === 4 && imagesData && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Step 4: {getSelectedChannel()?.type === 'TYPE_1' ? 'Review Configuration' : 'Review Images'} & Generate Final Video
            </h3>

            {/* TYPE_1: Background Videos Info */}
            {getSelectedChannel()?.type === 'TYPE_1' && imagesData.skipped && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Video className="text-blue-600" size={24} />
                  <div>
                    <div className="font-semibold text-gray-800">Using Background Videos</div>
                    <div className="text-sm text-gray-600">
                      TYPE_1 channel - Images skipped, using selected background videos from video bank
                    </div>
                  </div>
                </div>
                {getSelectedChannel()?.visualSettings?.type1?.backgroundVideos?.length > 0 && (
                  <div className="bg-white rounded-lg p-3 mt-3">
                    <div className="text-sm text-gray-700 mb-2">
                      <strong>{getSelectedChannel().visualSettings.type1.backgroundVideos.length}</strong> background videos selected
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {getSelectedChannel().visualSettings.type1.backgroundVideos.slice(0, 8).map((video, idx) => (
                        <div key={idx} className="relative aspect-video bg-gray-900 rounded overflow-hidden">
                          {video.thumbnail ? (
                            <img
                              src={`http://localhost:3000${video.thumbnail}`}
                              alt={video.filename}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Video className="text-gray-600" size={16} />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 bg-blue-600 text-white text-xs px-1">
                            #{idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                    {getSelectedChannel().visualSettings.type1.backgroundVideos.length > 8 && (
                      <div className="text-xs text-gray-500 mt-2">
                        ...and {getSelectedChannel().visualSettings.type1.backgroundVideos.length - 8} more
                      </div>
                    )}
                  </div>
                )}
                {getSelectedChannel()?.visualSettings?.type1?.personVideoOverlay && (
                  <div className="bg-white rounded-lg p-3 mt-3">
                    <div className="text-sm text-gray-700 mb-2">
                      <strong>Person Video Overlay:</strong> {getSelectedChannel().visualSettings.type1.personVideoOverlay.filename}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TYPE_2: Generated Images */}
            {getSelectedChannel()?.type !== 'TYPE_1' && !imagesData.skipped && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="text-sm">
                    <strong>Images Generated:</strong> {imagesData.successCount}/{imagesData.totalCount}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    💡 Review the AI-generated prompts and corresponding script segments below. Edit prompts to refine images.
                  </div>
                </div>

                {/* Images Grid */}
                <div className="space-y-4">
                  {imagesData.images.filter(img => img.success).map((img, idx) => {
                    const block = imagesData.imageBlocks?.[idx];
                    const isEditing = editingPromptIndex === idx;
                    const currentPrompt = getPromptForImage(idx);
                    const hasEdits = editedPrompts[idx] !== undefined;
                    
                    return (
                      <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                          {/* Image Preview */}
                          <div className="col-span-1">
                            <div className="relative">
                              <img
                                src={`http://localhost:3000${img.imagePath?.replace(/\\/g, '/').replace(/^.*temp/, '/temp')}`}
                                alt={`Image ${idx + 1}`}
                                className="w-full aspect-video object-cover rounded"
                              />
                              <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                                #{idx + 1}
                              </div>
                              {block && (
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                                  {block.start_time.toFixed(1)}s - {block.end_time.toFixed(1)}s
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Script Context & Prompt */}
                          <div className="col-span-2 space-y-3">
                            {/* Script Context */}
                            {block && block.sentences && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="text-gray-600" size={14} />
                                  <span className="text-xs font-semibold text-gray-700">Script Context</span>
                                </div>
                                <div className="text-xs text-gray-700 space-y-1 max-h-24 overflow-y-auto">
                                  {block.sentences.map((sentence, sIdx) => (
                                    <div key={sIdx} className="leading-relaxed">
                                      {sentence.text}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Image Prompt */}
                            <div className="bg-purple-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Image className="text-purple-600" size={14} />
                                  <span className="text-xs font-semibold text-gray-700">AI-Generated Prompt</span>
                                  {hasEdits && (
                                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                      Modified
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setEditingPromptIndex(isEditing ? null : idx)}
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  {isEditing ? 'Done' : 'Edit'}
                                </button>
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={currentPrompt}
                                  onChange={(e) => handlePromptEdit(idx, e.target.value)}
                                  rows={4}
                                  className="w-full text-xs px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  placeholder="Edit the image generation prompt..."
                                />
                              ) : (
                                <div className="text-xs text-gray-700 line-clamp-3">
                                  {currentPrompt}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {hasEdits && (
                                <>
                                  <button
                                    onClick={() => regenerateImage(idx, currentPrompt)}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                                  >
                                    <RefreshCw size={12} />
                                    Regenerate with Custom Prompt
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newEditedPrompts = { ...editedPrompts };
                                      delete newEditedPrompts[idx];
                                      setEditedPrompts(newEditedPrompts);
                                      setEditingPromptIndex(null);
                                    }}
                                    className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                  >
                                    Reset
                                  </button>
                                </>
                              )}
                              {!hasEdits && (
                                <button
                                  onClick={() => regenerateImage(idx)}
                                  disabled={loading}
                                  className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                  <RefreshCw size={12} />
                                  Regenerate
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Final Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={finalVideoStatus === 'completed'}
              >
                ← Back to Voice
              </button>
              <button
                onClick={handleGenerateFinal}
                disabled={loading || finalVideoJobId}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Generating Video...
                  </>
                ) : finalVideoStatus === 'completed' ? (
                  <>
                    <CheckCircle size={20} />
                    Video Complete!
                  </>
                ) : finalVideoStatus === 'active' || finalVideoStatus === 'processing' ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Processing Video...
                  </>
                ) : finalVideoJobId ? (
                  <>
                    <Clock size={20} />
                    Video Queued...
                  </>
                ) : (
                  <>
                    <Video size={20} />
                    Generate Final Video
                  </>
                )}
              </button>
            </div>

            {/* Job Status Display */}
            {finalVideoJobId && finalVideoStatus !== 'completed' && (
              <div className={`border rounded-lg p-4 ${
                finalVideoStatus === 'failed' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  {finalVideoStatus === 'failed' ? (
                    <AlertCircle className="text-red-600" size={24} />
                  ) : finalVideoStatus === 'active' || finalVideoStatus === 'processing' ? (
                    <Loader className="animate-spin text-blue-600" size={24} />
                  ) : (
                    <Clock className="text-blue-600" size={24} />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {finalVideoStatus === 'failed' ? 'Video Generation Failed' :
                       finalVideoStatus === 'active' || finalVideoStatus === 'processing' ? 'Video Processing...' :
                       'Video Queued'}
                    </div>
                    <div className="text-sm text-gray-600">Job ID: {finalVideoJobId}</div>
                    {(finalVideoStatus === 'waiting' || finalVideoStatus === 'active') && (
                      <div className="text-sm text-gray-600 mt-1">
                        Status updates automatically every 3 seconds
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Completed Video Display */}
            {finalVideoStatus === 'completed' && finalVideoResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={24} />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">Video Generated Successfully!</div>
                    <div className="text-sm text-gray-600">
                      Duration: {finalVideoResult.duration?.toFixed(1)}s
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-mono break-all">
                      Path: {finalVideoResult.videoPath}
                    </div>
                  </div>
                </div>

                {/* Video Player */}
                {finalVideoResult.videoPath && (
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      controls
                      className="w-full"
                      src={`http://localhost:3000${finalVideoResult.videoPath?.replace(/\\/g, '/').replace(/^[A-Z]:[/\\]?.*?[/\\]output/, '/output')}`}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* Download Button */}
                {finalVideoResult.videoPath && (
                  <a
                    href={`http://localhost:3000${finalVideoResult.videoPath?.replace(/\\/g, '/').replace(/^[A-Z]:[/\\]?.*?[/\\]output/, '/output')}`}
                    download={finalVideoResult.videoPath?.split(/[/\\]/).pop()}
                    className="block w-full text-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    Download Video
                  </a>
                )}

                {/* Start New Button */}
                <button
                  onClick={handleStartNew}
                  className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
                >
                  Create Another Video
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session History Modal */}
      {showSessionHistory && (
        <SessionHistoryModal
          channelId={config.channelId}
          onClose={() => setShowSessionHistory(false)}
          onSelect={handleLoadSession}
        />
      )}
    </div>
  );
};

export default StepByStepVideoGenerator;

