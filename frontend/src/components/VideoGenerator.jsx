import { useState, useEffect, useRef } from 'react';
import { Video, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Library, FileText, User, Music, Play, Pause, Volume2 } from 'lucide-react';
import { channelAPI, videoAPI, promptTemplateAPI } from '../services/api';
import ReferenceScripts from './ReferenceScripts';
import ScriptTemplates from './ScriptTemplates';
import VideoSelectionModal from './VideoSelectionModal';
import PromptTemplateLibrary from './PromptTemplateLibrary';
import PersonVideoSelectionModal from './PersonVideoSelectionModal';
import MusicSelectionModal from './MusicSelectionModal';

const VideoGenerator = ({ selectedChannel }) => {
  const [channels, setChannels] = useState([]);
  const audioRef = useRef(null);
  const [playingMusic, setPlayingMusic] = useState(false);
  const [formData, setFormData] = useState({
    channelId: selectedChannel?.id || '',
    title: '',
    context: '',
    customPrompt: '',
    useChannelReferenceScripts: true,
    additionalReferenceScripts: [],
    useChannelVideos: true,
    overrideVideos: [],
    useChannelPromptTemplate: true,
    overridePromptTemplateId: null,
    useChannelPersonOverlay: true,
    overridePersonOverlay: null,
    useChannelBackgroundMusic: true,
    overrideBackgroundMusic: null,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showChannelScripts, setShowChannelScripts] = useState(false);
  const [showAdditionalScripts, setShowAdditionalScripts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVideoSelection, setShowVideoSelection] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [channelPromptTemplate, setChannelPromptTemplate] = useState(null);
  const [overridePromptTemplate, setOverridePromptTemplate] = useState(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showPersonVideoSelection, setShowPersonVideoSelection] = useState(false);
  const [showMusicSelection, setShowMusicSelection] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      setFormData((prev) => ({ ...prev, channelId: selectedChannel.id }));
      loadChannelPromptTemplate(selectedChannel);
    }
  }, [selectedChannel]);

  useEffect(() => {
    const channel = getSelectedChannel();
    if (channel) {
      loadChannelPromptTemplate(channel);
    }
  }, [formData.channelId]);

  const loadChannelPromptTemplate = async (channel) => {
    if (channel?.scriptSettings?.promptTemplateId) {
      try {
        const response = await promptTemplateAPI.getById(channel.scriptSettings.promptTemplateId);
        setChannelPromptTemplate(response.template);
      } catch (err) {
        console.error('Error loading channel prompt template:', err);
      }
    } else {
      setChannelPromptTemplate(null);
    }
  };

  const loadChannels = async () => {
    try {
      const data = await channelAPI.getAll();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const getSelectedChannel = () => {
    return channels.find(ch => ch.id === formData.channelId);
  };

  const getChannelReferenceScripts = () => {
    const channel = getSelectedChannel();
    return channel?.scriptSettings?.referenceScripts || [];
  };

  const getActivePromptTemplate = () => {
    if (!formData.useChannelPromptTemplate && overridePromptTemplate) {
      return overridePromptTemplate;
    }
    if (formData.useChannelPromptTemplate && channelPromptTemplate) {
      return channelPromptTemplate;
    }
    return null;
  };

  const handleSelectOverrideTemplate = (template) => {
    setOverridePromptTemplate(template);
    setFormData({ ...formData, overridePromptTemplateId: template.id, useChannelPromptTemplate: false });
    setShowPromptTemplates(false);
  };

  const getChannelBackgroundVideos = () => {
    const channel = getSelectedChannel();
    return channel?.visualSettings?.type1?.backgroundVideos || [];
  };

  const getChannelPersonOverlay = () => {
    const channel = getSelectedChannel();
    return channel?.visualSettings?.type1?.personVideoOverlay || null;
  };

  const getChannelBackgroundMusic = () => {
    const channel = getSelectedChannel();
    // Check for new musicTracks format first, then fall back to old backgroundMusic
    if (channel?.audio?.musicTracks && channel.audio.musicTracks.length > 0) {
      return channel.audio.musicTracks;
    }
    return channel?.audio?.backgroundMusic || null;
  };

  const isType1Channel = () => {
    const channel = getSelectedChannel();
    return channel?.type === 'TYPE_1';
  };

  const handleTemplateSelect = (template) => {
    const newScripts = [...formData.additionalReferenceScripts, template];
    setFormData({ ...formData, additionalReferenceScripts: newScripts });
    setShowTemplates(false);
    setShowAdditionalScripts(true);
  };

  const handlePersonOverlaySelect = (overlaySettings) => {
    setFormData({ 
      ...formData, 
      overridePersonOverlay: {
        filename: overlaySettings.video.filename,
        path: overlaySettings.video.path,
        position: overlaySettings.position,
        scale: overlaySettings.scale,
        opacity: overlaySettings.opacity,
        chromaKey: overlaySettings.chromaKey,
      },
      useChannelPersonOverlay: false 
    });
    setShowPersonVideoSelection(false);
  };

  const handleMusicSelect = (musicSettings) => {
    setFormData({
      ...formData,
      overrideBackgroundMusic: {
        filename: musicSettings.music.filename,
        path: musicSettings.music.path,
        duration: musicSettings.music.duration,
        loop: musicSettings.loop,
        volume: musicSettings.volume,
        fadeIn: musicSettings.fadeIn,
        fadeOut: musicSettings.fadeOut,
      },
      useChannelBackgroundMusic: false,
    });
    setShowMusicSelection(false);
  };

  const toggleMusicPlay = () => {
    if (audioRef.current) {
      if (playingMusic) {
        audioRef.current.pause();
        setPlayingMusic(false);
      } else {
        audioRef.current.play();
        setPlayingMusic(true);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Combine channel and additional reference scripts
      let referenceScripts = [];
      
      if (formData.useChannelReferenceScripts) {
        const channelScripts = getChannelReferenceScripts();
        referenceScripts = [...channelScripts];
      }
      
      if (formData.additionalReferenceScripts.length > 0) {
        referenceScripts = [...referenceScripts, ...formData.additionalReferenceScripts];
      }

      // Extract just the content from scripts for the API
      const scriptContents = referenceScripts
        .filter(s => s.content && s.content.trim())
        .map(s => s.content);

      // Determine which prompt template to use
      const activeTemplate = getActivePromptTemplate();
      const promptTemplateId = activeTemplate?.id || null;

      // Determine person overlay to use (if TYPE_1)
      let personVideoOverlay = undefined;
      if (isType1Channel()) {
        if (formData.useChannelPersonOverlay) {
          personVideoOverlay = getChannelPersonOverlay();
        } else if (formData.overridePersonOverlay) {
          personVideoOverlay = formData.overridePersonOverlay;
        }
      }

      // Determine background music to use
      let backgroundMusic = undefined;
      let musicTracks = undefined;
      
      if (formData.useChannelBackgroundMusic) {
        const channelMusic = getChannelBackgroundMusic();
        // Check if it's the new format (array of tracks) or old format (single track)
        if (Array.isArray(channelMusic)) {
          musicTracks = channelMusic;
        } else if (channelMusic) {
          backgroundMusic = channelMusic;
        }
      } else if (formData.overrideBackgroundMusic) {
        backgroundMusic = formData.overrideBackgroundMusic;
      }

      const response = await videoAPI.generate({
        channelId: formData.channelId,
        title: formData.title,
        context: formData.context,
        promptTemplateId,
        customPrompt: formData.customPrompt || undefined,
        referenceScripts: scriptContents.length > 0 ? scriptContents : undefined,
        personVideoOverlay,
        backgroundMusic,
        musicTracks, // New: pass multiple tracks if available
      });

      setResult({
        jobId: response.jobId || response.batchId,
        message: response.message || `Video generation started (Job ID: ${response.jobId || response.batchId})`,
      });

      // Reset form
      setFormData({
        channelId: formData.channelId,
        title: '',
        context: '',
        customPrompt: '',
        useChannelReferenceScripts: true,
        additionalReferenceScripts: [],
      });
    } catch (err) {
      setError('Failed to generate video: ' + err.message);
      console.error('Error generating video:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showTemplates && (
        <ScriptTemplates
          onClose={() => setShowTemplates(false)}
          onSelect={handleTemplateSelect}
        />
      )}

      {showVideoSelection && (
        <VideoSelectionModal
          initialSelection={formData.overrideVideos}
          onClose={() => setShowVideoSelection(false)}
          onConfirm={(videos) => {
            setFormData({ ...formData, overrideVideos: videos });
          }}
        />
      )}
      
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Video className="text-blue-600" size={32} />
          <h2 className="text-2xl font-bold text-gray-800">Generate Video</h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-green-600 font-medium">{result.message}</p>
              <p className="text-green-700 text-sm mt-1">
                Job ID: <span className="font-mono">{result.jobId}</span>
              </p>
              <p className="text-green-600 text-sm mt-2">
                Check the Queue tab to monitor progress
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel *
            </label>
            <select
              required
              value={formData.channelId}
              onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a channel</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} ({channel.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter video title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context *
            </label>
            <textarea
              required
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Provide context or topic for the video content"
            />
            <p className="mt-1 text-sm text-gray-500">
              Describe what the video should be about. This will be used to generate the script.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Prompt (Optional)
            </label>
            <textarea
              value={formData.customPrompt}
              onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add custom instructions for script generation"
            />
            <p className="mt-1 text-sm text-gray-500">
              Optional: Add specific instructions or requirements for the script.
            </p>
          </div>

          {/* Prompt Template Section */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Prompt Template</h3>
            
            {formData.channelId && channelPromptTemplate && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useChannelTemplate"
                    checked={formData.useChannelPromptTemplate}
                    onChange={(e) => setFormData({ ...formData, useChannelPromptTemplate: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="useChannelTemplate" className="text-sm font-medium text-gray-700">
                    Use Channel's Prompt Template
                  </label>
                </div>

                {formData.useChannelPromptTemplate && channelPromptTemplate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{channelPromptTemplate.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {channelPromptTemplate.category}
                          </span>
                          <span className="text-xs text-gray-600">
                            {channelPromptTemplate.tone} · {channelPromptTemplate.length}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPromptPreview(!showPromptPreview)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {showPromptPreview ? '▼ Hide' : '▶ Show'} Template Instructions
                    </button>
                    {showPromptPreview && (
                      <div className="mt-2 p-2 bg-white border border-blue-200 rounded text-xs text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {channelPromptTemplate.customPrompt}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!formData.useChannelPromptTemplate && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPromptTemplates(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                >
                  <FileText size={16} />
                  {overridePromptTemplate ? 'Change Template' : 'Select Different Template'}
                </button>

                {overridePromptTemplate && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{overridePromptTemplate.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                            {overridePromptTemplate.category}
                          </span>
                          <span className="text-xs text-gray-600">
                            {overridePromptTemplate.tone} · {overridePromptTemplate.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!channelPromptTemplate && !overridePromptTemplate && (
              <p className="text-sm text-gray-500 italic">
                No prompt template selected. Default prompting will be used.
              </p>
            )}
          </div>

          {/* Reference Scripts Section */}
          {formData.channelId && getChannelReferenceScripts().length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useChannelScripts"
                  checked={formData.useChannelReferenceScripts}
                  onChange={(e) => setFormData({ ...formData, useChannelReferenceScripts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="useChannelScripts" className="text-sm font-medium text-gray-700">
                  Use Channel's Reference Scripts ({getChannelReferenceScripts().length})
                </label>
              </div>
              
              {formData.useChannelReferenceScripts && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowChannelScripts(!showChannelScripts)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showChannelScripts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {showChannelScripts ? 'Hide' : 'Show'} Channel's Reference Scripts
                  </button>
                  
                  {showChannelScripts && (
                    <div className="mt-3">
                      <ReferenceScripts
                        referenceScripts={getChannelReferenceScripts()}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Additional Reference Scripts */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdditionalScripts(!showAdditionalScripts)}
                className="flex items-center gap-2 text-left flex-1"
              >
                <span className="text-sm font-medium text-gray-700">
                  Add Additional Reference Scripts (For This Video Only)
                </span>
                {showAdditionalScripts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
              >
                <Library size={14} />
                Templates
              </button>
            </div>
            
            {showAdditionalScripts && (
              <div className="mt-3">
                <ReferenceScripts
                  referenceScripts={formData.additionalReferenceScripts}
                  onChange={(scripts) => setFormData({ ...formData, additionalReferenceScripts: scripts })}
                  maxScripts={3}
                />
              </div>
            )}
          </div>

          {/* TYPE_1 Background Videos */}
          {formData.channelId && isType1Channel() && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Background Videos (TYPE_1)</h3>
              
              {getChannelBackgroundVideos().length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useChannelVideos"
                    checked={formData.useChannelVideos}
                    onChange={(e) => setFormData({ ...formData, useChannelVideos: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="useChannelVideos" className="text-sm font-medium text-gray-700">
                    Use Channel's Background Videos ({getChannelBackgroundVideos().length})
                  </label>
                </div>
              )}

              {!formData.useChannelVideos || getChannelBackgroundVideos().length === 0 ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowVideoSelection(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    <Video size={16} />
                    Select Videos for This Generation
                  </button>
                  {formData.overrideVideos.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {formData.overrideVideos.length} video(s) selected
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    Using {getChannelBackgroundVideos().length} video(s) from channel configuration.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TYPE_1 Person Video Overlay */}
          {formData.channelId && isType1Channel() && getChannelPersonOverlay() && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User size={16} />
                Person Video Overlay
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useChannelPersonOverlay"
                  checked={formData.useChannelPersonOverlay}
                  onChange={(e) => setFormData({ ...formData, useChannelPersonOverlay: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="useChannelPersonOverlay" className="text-sm font-medium text-gray-700">
                  Use Channel's Person Overlay
                </label>
              </div>

              {formData.useChannelPersonOverlay ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    {getChannelPersonOverlay().thumbnail ? (
                      <img
                        src={`http://localhost:3000/person-videos/thumbnails/${getChannelPersonOverlay().filename.replace(/\.[^/.]+$/, '.jpg')}`}
                        alt="Person overlay"
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-300 rounded flex items-center justify-center">
                        <User size={24} className="text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm mb-1">
                        {getChannelPersonOverlay().filename}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {getChannelPersonOverlay().position.replace('-', ' ')}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          Scale: {getChannelPersonOverlay().scale}%
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          Opacity: {getChannelPersonOverlay().opacity}%
                        </span>
                        {getChannelPersonOverlay().chromaKey?.enabled && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Green Screen
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPersonVideoSelection(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    <User size={16} />
                    Select Different Overlay
                  </button>
                  
                  {formData.overridePersonOverlay && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded font-semibold">
                          OVERRIDE ACTIVE
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 bg-gray-300 rounded flex items-center justify-center">
                          <User size={24} className="text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 text-sm mb-1">
                            {formData.overridePersonOverlay.filename}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {formData.overridePersonOverlay.position.replace('-', ' ')}
                            </span>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              Scale: {formData.overridePersonOverlay.scale}%
                            </span>
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Opacity: {formData.overridePersonOverlay.opacity}%
                            </span>
                            {formData.overridePersonOverlay.chromaKey?.enabled && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Green Screen
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Multiple Music Tracks (New Format) */}
          {formData.channelId && Array.isArray(getChannelBackgroundMusic()) && getChannelBackgroundMusic().length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Music size={16} />
                Background Music Tracks ({getChannelBackgroundMusic().length})
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useChannelMusicTracks"
                  checked={formData.useChannelBackgroundMusic}
                  onChange={(e) => setFormData({ ...formData, useChannelBackgroundMusic: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="useChannelMusicTracks" className="text-sm font-medium text-gray-700">
                  Use Channel's Music Tracks
                </label>
              </div>

              {formData.useChannelBackgroundMusic && (
                <div className="space-y-2">
                  {getChannelBackgroundMusic().map((track, index) => (
                    <div key={track.id || index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm mb-1 truncate">
                            {track.music?.title || track.music?.filename || 'Unknown Track'}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {track.music?.duration && (
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                                {Math.floor(track.music.duration / 60)}:
                                {String(Math.floor(track.music.duration % 60)).padStart(2, '0')}
                              </span>
                            )}
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <Volume2 size={10} />
                              {track.volume}%
                            </span>
                            {track.startTime > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Starts: {track.startTime}s
                              </span>
                            )}
                            {track.loop && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Loop
                              </span>
                            )}
                            {track.fadeIn > 0 && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Fade In: {track.fadeIn}s
                              </span>
                            )}
                            {track.fadeOut > 0 && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Fade Out: {track.fadeOut}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-blue-600 italic">
                    💡 Music tracks will play in order. Edit in channel settings to modify.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Single Background Music (Old Format - Backward Compatibility) */}
          {formData.channelId && getChannelBackgroundMusic() && !Array.isArray(getChannelBackgroundMusic()) && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Music size={16} />
                Background Music
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useChannelBackgroundMusic"
                  checked={formData.useChannelBackgroundMusic}
                  onChange={(e) => setFormData({ ...formData, useChannelBackgroundMusic: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="useChannelBackgroundMusic" className="text-sm font-medium text-gray-700">
                  Use Channel's Background Music
                </label>
              </div>

              {formData.useChannelBackgroundMusic ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                      <Music size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm mb-1 truncate">
                        {getChannelBackgroundMusic().filename}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {getChannelBackgroundMusic().duration && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            {Math.floor(getChannelBackgroundMusic().duration / 60)}:
                            {String(Math.floor(getChannelBackgroundMusic().duration % 60)).padStart(2, '0')}
                          </span>
                        )}
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <Volume2 size={10} />
                          {getChannelBackgroundMusic().volume || 30}%
                        </span>
                        {getChannelBackgroundMusic().loop && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Loop
                          </span>
                        )}
                        {getChannelBackgroundMusic().fadeIn > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            Fade In: {getChannelBackgroundMusic().fadeIn}s
                          </span>
                        )}
                        {getChannelBackgroundMusic().fadeOut > 0 && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            Fade Out: {getChannelBackgroundMusic().fadeOut}s
                          </span>
                        )}
                      </div>
                      {/* Mini audio player */}
                      <div className="flex items-center gap-2">
                        <audio
                          ref={audioRef}
                          src={`http://localhost:3000/music/${getChannelBackgroundMusic().filename}`}
                          onEnded={() => setPlayingMusic(false)}
                        />
                        <button
                          type="button"
                          onClick={toggleMusicPlay}
                          className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                        >
                          {playingMusic ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <span className="text-xs text-gray-600">Preview</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMusicSelection(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <Music size={16} />
                    Select Different Music
                  </button>

                  {formData.overrideBackgroundMusic && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-semibold">
                          OVERRIDE ACTIVE
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
                          <Music size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm mb-1 truncate">
                            {formData.overrideBackgroundMusic.filename}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {formData.overrideBackgroundMusic.duration && (
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                                {Math.floor(formData.overrideBackgroundMusic.duration / 60)}:
                                {String(Math.floor(formData.overrideBackgroundMusic.duration % 60)).padStart(2, '0')}
                              </span>
                            )}
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
                              <Volume2 size={10} />
                              {formData.overrideBackgroundMusic.volume}%
                            </span>
                            {formData.overrideBackgroundMusic.loop && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Loop
                              </span>
                            )}
                            {formData.overrideBackgroundMusic.fadeIn > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Fade In: {formData.overrideBackgroundMusic.fadeIn}s
                              </span>
                            )}
                            {formData.overrideBackgroundMusic.fadeOut > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Fade Out: {formData.overrideBackgroundMusic.fadeOut}s
                              </span>
                            )}
                          </div>
                          {/* Mini audio player for override */}
                          <div className="flex items-center gap-2">
                            <audio
                              ref={audioRef}
                              src={`http://localhost:3000/music/${formData.overrideBackgroundMusic.filename}`}
                              onEnded={() => setPlayingMusic(false)}
                            />
                            <button
                              type="button"
                              onClick={toggleMusicPlay}
                              className="p-1.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                            >
                              {playingMusic ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <span className="text-xs text-gray-600">Preview</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !formData.channelId}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video size={20} />
            {loading ? 'Generating Video...' : 'Generate Video'}
          </button>
        </form>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">How it works:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li>Select a channel with predefined settings</li>
          <li>Provide a title and context for your video</li>
          <li>AI generates a script based on your input</li>
          <li>Images are generated for each scene</li>
          <li>Voice narration is added</li>
          <li>Everything is combined into a final video with subtitles</li>
        </ol>
      </div>
    </div>

    {/* Prompt Template Library Modal */}
    {showPromptTemplates && (
      <PromptTemplateLibrary
        onClose={() => setShowPromptTemplates(false)}
        onSelect={handleSelectOverrideTemplate}
        selectionMode={true}
      />
    )}

    {/* Person Video Selection Modal */}
    {showPersonVideoSelection && (
      <PersonVideoSelectionModal
        onClose={() => setShowPersonVideoSelection(false)}
        onConfirm={handlePersonOverlaySelect}
        initialSettings={formData.overridePersonOverlay}
      />
    )}

    {/* Music Selection Modal */}
    {showMusicSelection && (
      <MusicSelectionModal
        onClose={() => setShowMusicSelection(false)}
        onConfirm={handleMusicSelect}
        initialSettings={formData.overrideBackgroundMusic}
      />
    )}
    </>
  );
};

export default VideoGenerator;

