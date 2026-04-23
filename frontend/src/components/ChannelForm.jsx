import { useState, useEffect } from 'react';
import { X, Save, Library, Video, FileText, User, HelpCircle, Music, Type, Activity } from 'lucide-react';
import { channelAPI, promptTemplateAPI } from '../services/api';
import ReferenceScripts from './ReferenceScripts';
import ScriptTemplates from './ScriptTemplates';
import VideoSelectionModal from './VideoSelectionModal';
import PromptTemplateLibrary from './PromptTemplateLibrary';
import PersonVideoSelectionModal from './PersonVideoSelectionModal';
import PersonVideoPoolModal from './PersonVideoPoolModal';
import SoundWaveSelectionModal from './SoundWaveSelectionModal';
import TextOverlayEditor from './TextOverlayEditor';
import MusicTracksEditor from './MusicTracksEditor';
import VoiceCloneModal from './VoiceCloneModal';

const ChannelForm = ({ channel, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'TYPE_1',
    voiceSettings: {
      provider: 'elevenlabs',
      voice: 'Rachel',
      speed: 1.0,
      voiceCloneId: null, // For genAi pro voice clones
      language: 'English', // Language of the voice/clone
    },
    visualSettings: {
      imageStyle: 'cinematic',
      aspectRatio: '9:16',
      quality: 'standard',
        type1: {
          backgroundVideos: [],
          shuffleVideos: false,
          loopIfNeeded: true,
          maxVideosToUse: 10,
          overlayType: 'none', // 'none', 'static', 'person'
          personVideoOverlay: null,
          personVideoPool: [], // Multiple person videos for random selection in batch
          usePersonVideoPool: false, // Enable random person overlay cycling
          soundWaveOverlay: null,
          textOverlays: [],
        },
    },
    subtitleSettings: {
      fontFamily: 'Montserrat',
      fontSize: 32,
      primaryColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      animation: {
        type: 'none',
        duration: 0.5,
      },
    },
    scriptSettings: {
      referenceScripts: [],
      promptTemplateId: null,
      customPrompt: '',
    },
    effects: {
      overlay: null, // Single overlay effect (only one at a time)
      particleOpacity: 0.3,
      movementEffects: [], // User must explicitly select
      transitionEffects: [], // User must explicitly select
    },
    audio: {
      backgroundMusic: null, // Deprecated: kept for backward compatibility
      musicTracks: [], // New: Array of music tracks with ordering
      loop: true,
      volume: 30,
      fadeIn: 2,
      fadeOut: 2,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVideoSelection, setShowVideoSelection] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showPersonVideoSelection, setShowPersonVideoSelection] = useState(false);
  const [showPersonVideoPoolModal, setShowPersonVideoPoolModal] = useState(false);
  const [showSoundWaveSelection, setShowSoundWaveSelection] = useState(false);
  const [showVoiceCloneModal, setShowVoiceCloneModal] = useState(false);

  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name || '',
        type: channel.type || 'TYPE_1',
        voiceSettings: {
          provider: channel.voiceSettings?.provider || 'elevenlabs',
          voice: channel.voiceSettings?.voice || 'Rachel',
          speed: channel.voiceSettings?.speed || 1.0,
          voiceCloneId: channel.voiceSettings?.voiceCloneId || null,
          language: channel.voiceSettings?.language || 'English',
        },
        visualSettings: {
          imageStyle: channel.visualSettings?.imageStyle || 'cinematic',
          aspectRatio: channel.visualSettings?.aspectRatio || '9:16',
          quality: channel.visualSettings?.quality || 'standard',
          type1: {
            backgroundVideos: channel.visualSettings?.type1?.backgroundVideos || [],
            shuffleVideos: channel.visualSettings?.type1?.shuffleVideos || false,
            loopIfNeeded: channel.visualSettings?.type1?.loopIfNeeded !== undefined 
              ? channel.visualSettings.type1.loopIfNeeded 
              : true,
            maxVideosToUse: channel.visualSettings?.type1?.maxVideosToUse || 10,
            overlayType: channel.visualSettings?.type1?.overlayType || 'none',
            personVideoOverlay: channel.visualSettings?.type1?.personVideoOverlay || null,
            personVideoPool: channel.visualSettings?.type1?.personVideoPool || [],
            usePersonVideoPool: channel.visualSettings?.type1?.usePersonVideoPool || false,
            soundWaveOverlay: channel.visualSettings?.type1?.soundWaveOverlay || null,
            textOverlays: channel.visualSettings?.type1?.textOverlays || [],
          },
        },
        subtitleSettings: {
          fontFamily: channel.subtitleSettings?.fontFamily || 'Montserrat',
          fontSize: channel.subtitleSettings?.fontSize || 32,
          primaryColor: channel.subtitleSettings?.primaryColor || '#FFFFFF',
          outlineColor: channel.subtitleSettings?.outlineColor || '#000000',
          outlineWidth: channel.subtitleSettings?.outlineWidth || 3,
          animation: {
            type: channel.subtitleSettings?.animation?.type || 'none',
            duration: channel.subtitleSettings?.animation?.duration || 0.5,
          },
        },
        scriptSettings: {
          referenceScripts: channel.scriptSettings?.referenceScripts || [],
          promptTemplateId: channel.scriptSettings?.promptTemplateId || null,
          customPrompt: channel.scriptSettings?.customPrompt || '',
        },
        effects: {
          overlay: channel.effects?.overlay || channel.effects?.overlays?.[0] || null, // Migrate from old overlays array to single overlay
          particleOpacity: channel.effects?.particleOpacity || 0.3,
          movementEffects: channel.effects?.movementEffects || [], // Use exactly what user configured
          transitionEffects: channel.effects?.transitionEffects || [], // Use exactly what user configured
        },
        audio: {
          backgroundMusic: channel.audio?.backgroundMusic || null,
          musicTracks: channel.audio?.musicTracks || [],
          loop: channel.audio?.loop !== undefined ? channel.audio.loop : true,
          volume: channel.audio?.volume || 30,
          fadeIn: channel.audio?.fadeIn || 2,
          fadeOut: channel.audio?.fadeOut || 2,
        },
      });
      
      // Load selected prompt template if ID exists
      if (channel.scriptSettings?.promptTemplateId) {
        loadPromptTemplate(channel.scriptSettings.promptTemplateId);
      }
    }
  }, [channel]);

  const loadPromptTemplate = async (templateId) => {
    try {
      const response = await promptTemplateAPI.getById(templateId);
      setSelectedPromptTemplate(response.template);
    } catch (err) {
      console.error('Error loading prompt template:', err);
    }
  };

  const handleSelectPromptTemplate = (template) => {
    setSelectedPromptTemplate(template);
    setFormData(prev => ({
      ...prev,
      scriptSettings: {
        ...prev.scriptSettings,
        promptTemplateId: template.id,
      },
    }));
    setShowPromptTemplates(false);
  };

  const handleCustomizePrompt = () => {
    if (selectedPromptTemplate) {
      setFormData(prev => ({
        ...prev,
        scriptSettings: {
          ...prev.scriptSettings,
          customPrompt: selectedPromptTemplate.customPrompt,
        },
      }));
      setShowPromptPreview(true);
    }
  };

  const handleClearPromptTemplate = () => {
    setSelectedPromptTemplate(null);
    setFormData(prev => ({
      ...prev,
      scriptSettings: {
        ...prev.scriptSettings,
        promptTemplateId: null,
        customPrompt: '',
      },
    }));
  };

  const handlePersonVideoSelect = (overlaySettings) => {
    if (overlaySettings) {
      updateField('visualSettings', 'type1', {
        ...formData.visualSettings.type1,
        personVideoOverlay: {
          // Save complete video metadata for re-editing
          ...overlaySettings.video,
          // Overlay settings
          position: overlaySettings.position,
          scale: overlaySettings.scale,
          opacity: overlaySettings.opacity,
          chromaKey: overlaySettings.chromaKey,
        },
      });
    }
    setShowPersonVideoSelection(false);
  };

  const handleRemovePersonOverlay = () => {
    updateField('visualSettings', 'type1', {
      ...formData.visualSettings.type1,
      overlayType: 'none',
      personVideoOverlay: null,
    });
  };

  const handleSoundWaveSelect = (overlaySettings) => {
    if (overlaySettings) {
      updateField('visualSettings', 'type1', {
        ...formData.visualSettings.type1,
        soundWaveOverlay: {
          // Save complete wave metadata for re-editing
          ...overlaySettings.wave,
          // Overlay settings
          position: overlaySettings.position,
          scale: overlaySettings.scale,
          opacity: overlaySettings.opacity,
        },
      });
    }
    setShowSoundWaveSelection(false);
  };

  const handleRemoveSoundWaveOverlay = () => {
    updateField('visualSettings', 'type1', {
      ...formData.visualSettings.type1,
      soundWaveOverlay: null,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (channel?.id) {
        await channelAPI.update(channel.id, formData);
      } else {
        await channelAPI.create(formData);
      }
      onSave();
    } catch (err) {
      setError('Failed to save channel: ' + err.message);
      console.error('Error saving channel:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleTemplateSelect = (template) => {
    const newScripts = [...formData.scriptSettings.referenceScripts, template];
    updateField('scriptSettings', 'referenceScripts', newScripts);
    setShowTemplates(false);
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
          initialSelection={formData.visualSettings.type1.backgroundVideos}
          onClose={() => setShowVideoSelection(false)}
          onConfirm={(videos) => {
            updateField('visualSettings', 'type1', {
              ...formData.visualSettings.type1,
              backgroundVideos: videos
            });
          }}
        />
      )}
      
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {channel ? 'Edit Channel' : 'New Channel'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Basic Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Channel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TYPE_1">TYPE_1 (Educational)</option>
                <option value="TYPE_2">TYPE_2 (Story)</option>
              </select>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Voice Settings</h3>
              {formData.voiceSettings.provider === 'genaipro' && (
                <button
                  type="button"
                  onClick={() => setShowVoiceCloneModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                >
                  <User size={16} />
                  Manage Voice Clones
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  value={formData.voiceSettings.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    updateField('voiceSettings', 'provider', newProvider);
                    // Clear voice clone ID if switching away from genaipro
                    if (newProvider !== 'genaipro') {
                      updateField('voiceSettings', 'voiceCloneId', null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="genaipro">genAi pro (Voice Cloning)</option>
                  <option value="mock">Mock (Testing)</option>
                </select>
              </div>
              {formData.voiceSettings.provider === 'genaipro' ? (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voice Clone
                  </label>
                  {formData.voiceSettings.voiceCloneId ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        <span className="text-sm text-gray-700">Using cloned voice</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVoiceCloneModal(true)}
                        className="px-4 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('voiceSettings', 'voiceCloneId', null)}
                        className="px-4 py-2 text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowVoiceCloneModal(true)}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm text-gray-700"
                    >
                      Select Voice Clone
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Voice
                    </label>
                    <input
                      type="text"
                      value={formData.voiceSettings.voice}
                      onChange={(e) => updateField('voiceSettings', 'voice', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Rachel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Speed
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2.0"
                      value={formData.voiceSettings.speed}
                      onChange={(e) => updateField('voiceSettings', 'speed', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Visual Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Visual Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image Style
                </label>
                <select
                  value={formData.visualSettings.imageStyle}
                  onChange={(e) => updateField('visualSettings', 'imageStyle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cinematic">Cinematic</option>
                  <option value="realistic">Realistic</option>
                  <option value="artistic">Artistic</option>
                  <option value="anime">Anime</option>
                  <option value="cartoon">Cartoon</option>
                  <option value="photographic">Photographic</option>
                  <option value="digital-art">Digital Art</option>
                  <option value="3d-render">3D Render</option>
                  <option value="fantasy">Fantasy</option>
                  <option value="minimalist">Minimalist</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={formData.visualSettings.aspectRatio}
                  onChange={(e) => updateField('visualSettings', 'aspectRatio', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="16:9">16:9 (Horizontal)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality
                </label>
                <select
                  value={formData.visualSettings.quality}
                  onChange={(e) => updateField('visualSettings', 'quality', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="standard">Standard</option>
                  <option value="hd">HD</option>
                </select>
              </div>
            </div>
          </div>

          {/* TYPE_1 Background Video Settings */}
          {formData.type === 'TYPE_1' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Background Video Settings</h3>
              <p className="text-sm text-gray-600">
                Select background videos for TYPE_1 (slideshow) generation
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => setShowVideoSelection(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Video size={16} />
                  Select Videos from Bank
                </button>
              </div>

              {/* Selected Videos Preview */}
              {formData.visualSettings.type1.backgroundVideos.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Selected Videos ({formData.visualSettings.type1.backgroundVideos.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => updateField('visualSettings', 'type1', {
                        ...formData.visualSettings.type1,
                        backgroundVideos: []
                      })}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {formData.visualSettings.type1.backgroundVideos.map((video, index) => (
                      <div key={video.filename} className="relative group">
                        <div className="relative aspect-video bg-gray-900 rounded overflow-hidden">
                          {video.thumbnail ? (
                            <img
                              src={`http://localhost:3000${video.thumbnail}`}
                              alt={video.filename}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Video className="text-gray-600" size={24} />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const newVideos = formData.visualSettings.type1.backgroundVideos.filter((_, i) => i !== index);
                              updateField('visualSettings', 'type1', {
                                ...formData.visualSettings.type1,
                                backgroundVideos: newVideos
                              });
                            }}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X size={12} />
                          </button>
                          <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-xs px-1 rounded">
                            #{index + 1}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 truncate" title={video.filename}>
                          {video.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="shuffleVideos"
                    checked={formData.visualSettings.type1.shuffleVideos}
                    onChange={(e) => updateField('visualSettings', 'type1', {
                      ...formData.visualSettings.type1,
                      shuffleVideos: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="shuffleVideos" className="text-sm text-gray-700">
                    Shuffle videos
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="loopIfNeeded"
                    checked={formData.visualSettings.type1.loopIfNeeded}
                    onChange={(e) => updateField('visualSettings', 'type1', {
                      ...formData.visualSettings.type1,
                      loopIfNeeded: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="loopIfNeeded" className="text-sm text-gray-700">
                    Loop if needed
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max videos to use
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.visualSettings.type1.maxVideosToUse}
                    onChange={(e) => updateField('visualSettings', 'type1', {
                      ...formData.visualSettings.type1,
                      maxVideosToUse: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Overlay Settings */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-800">Overlay Settings</h4>
                  <button
                    type="button"
                    onClick={() => alert('Overlays add visual elements on top of background videos.\n\n• Static Image: Fixed image overlay (company logo, watermark)\n• Person Video: Looping person video (talking head, presenter)\n\nOnly one overlay type can be active at a time.')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Overlay Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overlay Type
                    </label>
                    <div className="space-y-2">
                      {/* No Overlay */}
                      <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50" style={{
                        borderColor: formData.visualSettings.type1.overlayType === 'none' ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: formData.visualSettings.type1.overlayType === 'none' ? '#eff6ff' : 'white'
                      }}>
                        <input
                          type="radio"
                          name="overlayType"
                          value="none"
                          checked={formData.visualSettings.type1.overlayType === 'none'}
                          onChange={(e) => updateField('visualSettings', 'type1', {
                            ...formData.visualSettings.type1,
                            overlayType: e.target.value
                          })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">No Overlay</div>
                          <div className="text-xs text-gray-600">Just background videos and subtitles</div>
                        </div>
                      </label>

                      {/* Static Image Overlay */}
                      <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50" style={{
                        borderColor: formData.visualSettings.type1.overlayType === 'static' ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: formData.visualSettings.type1.overlayType === 'static' ? '#eff6ff' : 'white'
                      }}>
                        <input
                          type="radio"
                          name="overlayType"
                          value="static"
                          checked={formData.visualSettings.type1.overlayType === 'static'}
                          onChange={(e) => updateField('visualSettings', 'type1', {
                            ...formData.visualSettings.type1,
                            overlayType: e.target.value
                          })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">Static Image Overlay</div>
                          <div className="text-xs text-gray-600">Fixed image (logo, watermark)</div>
                        </div>
                      </label>

                      {/* Person Video Overlay */}
                      <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50" style={{
                        borderColor: formData.visualSettings.type1.overlayType === 'person' ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: formData.visualSettings.type1.overlayType === 'person' ? '#eff6ff' : 'white'
                      }}>
                        <input
                          type="radio"
                          name="overlayType"
                          value="person"
                          checked={formData.visualSettings.type1.overlayType === 'person'}
                          onChange={(e) => updateField('visualSettings', 'type1', {
                            ...formData.visualSettings.type1,
                            overlayType: e.target.value
                          })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <User className="w-5 h-5 text-gray-500" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">Looped Person Video Overlay</div>
                          <div className="text-xs text-gray-600">Animated person video (talking head, presenter)</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Person Video Pool for Batch Random Selection */}
                  {formData.visualSettings.type1.overlayType === 'person' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="usePersonVideoPool"
                          checked={formData.visualSettings.type1.usePersonVideoPool}
                          onChange={(e) => updateField('visualSettings', 'type1', {
                            ...formData.visualSettings.type1,
                            usePersonVideoPool: e.target.checked
                          })}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="usePersonVideoPool" className="text-sm font-medium text-purple-800">
                          🎲 Use Random Person Overlay Pool (For Batch Videos)
                        </label>
                      </div>

                      {formData.visualSettings.type1.usePersonVideoPool && (
                        <>
                          <p className="text-xs text-purple-700 mb-3">
                            When enabled, each video in a batch will randomly select a different person overlay from the pool below. 
                            Perfect for creating variety in bulk video generation!
                          </p>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-purple-800">
                                Person Video Pool ({formData.visualSettings.type1.personVideoPool.length})
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPersonVideoPoolModal(true)}
                                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                              >
                                {formData.visualSettings.type1.personVideoPool.length > 0 ? 'Manage Pool' : '+ Add Videos'}
                              </button>
                            </div>

                            {formData.visualSettings.type1.personVideoPool.length > 0 ? (
                              <div className="bg-white border border-purple-200 rounded-lg p-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {formData.visualSettings.type1.personVideoPool.map((video, index) => (
                                    <div key={video.filename + index} className="relative group">
                                      <div className="relative aspect-video bg-gray-900 rounded overflow-hidden">
                                        <video
                                          src={`http://localhost:3000/person-videos/${video.filename}`}
                                          className="w-full h-full object-cover"
                                          muted
                                          loop
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newPool = formData.visualSettings.type1.personVideoPool.filter((_, i) => i !== index);
                                            updateField('visualSettings', 'type1', {
                                              ...formData.visualSettings.type1,
                                              personVideoPool: newPool
                                            });
                                          }}
                                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                                        >
                                          <X size={12} />
                                        </button>
                                        <div className="absolute bottom-1 left-1 bg-purple-600 text-white text-xs px-1 rounded">
                                          #{index + 1}
                                        </div>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-600 truncate" title={video.filename}>
                                        {video.filename}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
                                <p className="text-sm text-purple-600 mb-2">No person videos in pool</p>
                                <button
                                  type="button"
                                  onClick={() => setShowPersonVideoPoolModal(true)}
                                  className="text-sm text-purple-700 hover:text-purple-800 font-medium underline"
                                >
                                  Add person videos to pool
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Person Video Configuration */}
                  {formData.visualSettings.type1.overlayType === 'person' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                      {formData.visualSettings.type1.personVideoOverlay ? (
                        // Display selected person video
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-4">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded overflow-hidden">
                              <video
                                src={`http://localhost:3000/person-videos/${formData.visualSettings.type1.personVideoOverlay.filename}`}
                                className="w-full h-full object-cover"
                                muted
                                loop
                                autoPlay
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                              <div className="font-medium text-gray-800 mb-2">
                                {formData.visualSettings.type1.personVideoOverlay.filename}
                              </div>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  {formData.visualSettings.type1.personVideoOverlay.position.replace('-', ' ')}
                                </span>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Scale: {formData.visualSettings.type1.personVideoOverlay.scale}%
                                </span>
                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                  Opacity: {formData.visualSettings.type1.personVideoOverlay.opacity}%
                                </span>
                                {formData.visualSettings.type1.personVideoOverlay.chromaKey?.enabled && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                    Green Screen
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowPersonVideoSelection(true)}
                                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Change Settings
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRemovePersonOverlay}
                                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // No person video selected
                        <div className="text-center py-6">
                          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-3">No person video selected</p>
                          <button
                            type="button"
                            onClick={() => setShowPersonVideoSelection(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            Select Person Video
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Static Image Overlay (existing functionality placeholder) */}
                  {formData.visualSettings.type1.overlayType === 'static' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 italic">
                        Static image overlay configuration coming soon...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Subtitle Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Subtitle Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Family
                </label>
                <select
                  value={formData.subtitleSettings.fontFamily}
                  onChange={(e) => updateField('subtitleSettings', 'fontFamily', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Montserrat">Montserrat</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                  <option value="Source Sans Pro">Source Sans Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size
                </label>
                <input
                  type="number"
                  min="16"
                  max="72"
                  value={formData.subtitleSettings.fontSize}
                  onChange={(e) => updateField('subtitleSettings', 'fontSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
                <input
                  type="color"
                  value={formData.subtitleSettings.primaryColor}
                  onChange={(e) => updateField('subtitleSettings', 'primaryColor', e.target.value)}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outline Color
                </label>
                <input
                  type="color"
                  value={formData.subtitleSettings.outlineColor}
                  onChange={(e) => updateField('subtitleSettings', 'outlineColor', e.target.value)}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outline Width
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.subtitleSettings.outlineWidth}
                  onChange={(e) => updateField('subtitleSettings', 'outlineWidth', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Animation Settings */}
            <div className="mt-6 space-y-4 border-t pt-4">
              <h4 className="font-medium text-gray-800">Subtitle Animation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Animation Type
                  </label>
                  <select
                    value={formData.subtitleSettings.animation.type}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        subtitleSettings: {
                          ...formData.subtitleSettings,
                          animation: {
                            ...formData.subtitleSettings.animation,
                            type: e.target.value
                          }
                        }
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">None (Instant Appear)</option>
                    <option value="fade-in">Fade In</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="slide-left">Slide In from Left</option>
                    <option value="slide-right">Slide In from Right</option>
                    <option value="zoom-in">Zoom In</option>
                    <option value="bounce-in">Bounce In</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    How subtitles appear on screen
                  </p>
                </div>

                {formData.subtitleSettings.animation.type !== 'none' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Animation Duration
                      </label>
                      <span className="text-sm font-semibold text-blue-600">
                        {formData.subtitleSettings.animation.duration}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={formData.subtitleSettings.animation.duration}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          subtitleSettings: {
                            ...formData.subtitleSettings,
                            animation: {
                              ...formData.subtitleSettings.animation,
                              duration: parseFloat(e.target.value)
                            }
                          }
                        });
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Fast (0.1s)</span>
                      <span>Slow (2.0s)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Animation Preview */}
              {formData.subtitleSettings.animation.type !== 'none' && (
                <div className="bg-gray-900 rounded-lg p-6 relative overflow-hidden" style={{ minHeight: '100px' }}>
                  <p className="text-xs text-gray-400 mb-2">Preview:</p>
                  <div 
                    className="text-center"
                    style={{
                      fontFamily: formData.subtitleSettings.fontFamily,
                      fontSize: '20px',
                      color: formData.subtitleSettings.primaryColor,
                      textShadow: `
                        -${formData.subtitleSettings.outlineWidth}px -${formData.subtitleSettings.outlineWidth}px 0 ${formData.subtitleSettings.outlineColor},
                        ${formData.subtitleSettings.outlineWidth}px -${formData.subtitleSettings.outlineWidth}px 0 ${formData.subtitleSettings.outlineColor},
                        -${formData.subtitleSettings.outlineWidth}px ${formData.subtitleSettings.outlineWidth}px 0 ${formData.subtitleSettings.outlineColor},
                        ${formData.subtitleSettings.outlineWidth}px ${formData.subtitleSettings.outlineWidth}px 0 ${formData.subtitleSettings.outlineColor}
                      `,
                      animation: `${formData.subtitleSettings.animation.type} ${formData.subtitleSettings.animation.duration}s ease-out infinite`
                    }}
                  >
                    This is how your subtitle will appear
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Effects */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Visual Effects</h3>
            
            {/* Visual Overlay Effect - Single Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visual Overlay Effect
                <span className="text-xs text-gray-500 ml-2">(Select one)</span>
              </label>
              <select
                value={formData.effects.overlay || ''}
                onChange={(e) => updateField('effects', 'overlay', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None</option>
                <option value="small_dust">Small Dust</option>
                <option value="medium_dust">Medium Dust</option>
                <option value="old_camera">Old Camera</option>
                <option value="flashes_stars">Flashes & Stars</option>
                <option value="bubbles">Bubbles</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose one overlay effect to apply over your video
              </p>
            </div>

            {/* Particle Opacity */}
            {formData.effects.overlay && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Overlay Opacity
                  </label>
                  <span className="text-sm font-semibold text-blue-600">
                    {Math.round(formData.effects.particleOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.effects.particleOpacity}
                  onChange={(e) => updateField('effects', 'particleOpacity', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Transparent (0%)</span>
                  <span>Opaque (100%)</span>
                </div>
              </div>
            )}

            {/* Movement Effects */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Movement Effects
                <span className="text-xs text-gray-500 ml-2">(Applied to images/videos)</span>
              </label>
              <div className="space-y-2">
                {[
                  { value: 'zoom_rotate_cycle', label: 'Zoom & Rotate Cycle', description: 'Smooth zoom in/out with rotation' },
                  { value: 'ken_burns', label: 'Ken Burns', description: 'Classic pan and zoom effect' },
                  { value: 'parallax', label: 'Parallax', description: '3D-like depth effect' },
                ].map((effect) => (
                  <label key={effect.value} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={formData.effects.movementEffects.includes(effect.value)}
                      onChange={(e) => {
                        const current = formData.effects.movementEffects;
                        if (e.target.checked) {
                          updateField('effects', 'movementEffects', [...current, effect.value]);
                        } else {
                          updateField('effects', 'movementEffects', current.filter(m => m !== effect.value));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{effect.label}</div>
                      <div className="text-xs text-gray-600">{effect.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Transition Effects */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transition Effects
                <span className="text-xs text-gray-500 ml-2">(Between images/videos)</span>
              </label>
              <div className="space-y-2">
                {[
                  { value: 'smoothleft', label: 'Smooth Left', description: 'Slides smoothly to the left' },
                  { value: 'smoothright', label: 'Smooth Right', description: 'Slides smoothly to the right' },
                  { value: 'smoothup', label: 'Smooth Up', description: 'Slides smoothly upward' },
                  { value: 'smoothdown', label: 'Smooth Down', description: 'Slides smoothly downward' },
                  { value: 'fadeblack', label: 'Fade to Black', description: 'Fades through black' },
                  { value: 'fadewhite', label: 'Fade to White', description: 'Fades through white' },
                  { value: 'circlecrop', label: 'Circle Crop', description: 'Circular wipe transition' },
                  { value: 'dissolve', label: 'Dissolve', description: 'Crossfade dissolve' },
                ].map((effect) => (
                  <label key={effect.value} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={formData.effects.transitionEffects.includes(effect.value)}
                      onChange={(e) => {
                        const current = formData.effects.transitionEffects;
                        if (e.target.checked) {
                          updateField('effects', 'transitionEffects', [...current, effect.value]);
                        } else {
                          updateField('effects', 'transitionEffects', current.filter(t => t !== effect.value));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{effect.label}</div>
                      <div className="text-xs text-gray-600">{effect.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Background Music - Multiple Tracks */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Music size={20} />
              <h3 className="text-lg font-semibold text-gray-800">Background Music (Optional)</h3>
            </div>
            
            <MusicTracksEditor
              tracks={formData.audio.musicTracks}
              onChange={(newTracks) => {
                setFormData({
                  ...formData,
                  audio: {
                    ...formData.audio,
                    musicTracks: newTracks
                  }
                });
              }}
              maxTracks={5}
            />

            {/* Migration Notice for Old Single Background Music */}
            {formData.audio.backgroundMusic && formData.audio.musicTracks.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-3">
                  ⚠️ You have a single background music track saved in the old format. Would you like to migrate it to the new multi-track system?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const migratedTrack = {
                      music: formData.audio.backgroundMusic,
                      volume: formData.audio.volume,
                      fadeIn: formData.audio.fadeIn,
                      fadeOut: formData.audio.fadeOut,
                      loop: formData.audio.loop,
                      startTime: 0,
                      id: `track_${Date.now()}_migrated`,
                    };
                    setFormData({
                      ...formData,
                      audio: {
                        ...formData.audio,
                        musicTracks: [migratedTrack],
                        backgroundMusic: null, // Clear old format
                      }
                    });
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition text-sm"
                >
                  Migrate to Multi-Track System
                </button>
              </div>
            )}
          </div>

          {/* Custom Text Overlays - TYPE_1 Only */}
          {formData.type === 'TYPE_1' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Type size={20} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Custom Text Overlays (Optional)</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Add text overlays separate from subtitles. Perfect for branding, calls-to-action, or titles. Maximum 5 overlays.
                  </p>
                </div>
              </div>
              
              <TextOverlayEditor
                overlays={formData.visualSettings.type1.textOverlays}
                onChange={(newOverlays) => {
                  setFormData({
                    ...formData,
                    visualSettings: {
                      ...formData.visualSettings,
                      type1: {
                        ...formData.visualSettings.type1,
                        textOverlays: newOverlays
                      }
                    }
                  });
                }}
                maxOverlays={5}
              />
            </div>
          )}

          {/* Sound Wave Overlay - TYPE_1 Only */}
          {formData.type === 'TYPE_1' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity size={20} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Sound Wave Animation (Optional)</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Add an animated sound wave overlay. Perfect for music visualizations or audio-focused content. Supports GIF and video formats.
                  </p>
                </div>
              </div>

              {formData.visualSettings.type1.soundWaveOverlay ? (
                // Display selected sound wave
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded overflow-hidden">
                      {formData.visualSettings.type1.soundWaveOverlay.isGif ? (
                        <img
                          src={`http://localhost:3000/sound-waves/${formData.visualSettings.type1.soundWaveOverlay.filename}`}
                          className="w-full h-full object-cover"
                          alt="Sound wave"
                        />
                      ) : (
                        <video
                          src={`http://localhost:3000/sound-waves/${formData.visualSettings.type1.soundWaveOverlay.filename}`}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          autoPlay
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 mb-2">
                        {formData.visualSettings.type1.soundWaveOverlay.filename}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {formData.visualSettings.type1.soundWaveOverlay.position.replace('-', ' ')}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Scale: {formData.visualSettings.type1.soundWaveOverlay.scale}%
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          Opacity: {formData.visualSettings.type1.soundWaveOverlay.opacity}%
                        </span>
                        {formData.visualSettings.type1.soundWaveOverlay.isGif && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            GIF
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSoundWaveSelection(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Change Settings
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveSoundWaveOverlay}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // No sound wave selected
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">No sound wave animation selected</p>
                  <button
                    type="button"
                    onClick={() => setShowSoundWaveSelection(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Select Sound Wave
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prompt Template */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Prompt Template</h3>
              <button
                type="button"
                onClick={() => setShowPromptTemplates(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
              >
                <FileText size={16} />
                Browse Templates
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Choose a prompt template to define the style, structure, and approach for script generation.
            </p>

            {selectedPromptTemplate ? (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{selectedPromptTemplate.name}</h4>
                      {selectedPromptTemplate.isDefault && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                          System
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {selectedPromptTemplate.category}
                      </span>
                      <span className="text-xs text-gray-600">
                        {selectedPromptTemplate.tone} · {selectedPromptTemplate.length}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPromptTemplate}
                    className="text-gray-400 hover:text-red-600 transition"
                    title="Remove template"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showPromptPreview ? '▼ Hide' : '▶ Show'} Template Prompt
                  </button>
                  {showPromptPreview && (
                    <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-xs text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {selectedPromptTemplate.customPrompt}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCustomizePrompt}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  ✏️ Customize for this channel
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-3">No prompt template selected</p>
                <button
                  type="button"
                  onClick={() => setShowPromptTemplates(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Choose Template
                </button>
              </div>
            )}

            {/* Custom Prompt Override */}
            {formData.scriptSettings.customPrompt && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Prompt (Channel-Specific)
                </label>
                <textarea
                  value={formData.scriptSettings.customPrompt}
                  onChange={(e) => updateField('scriptSettings', 'customPrompt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="Customize the template prompt for this channel..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will override the template prompt for this channel only
                </p>
              </div>
            )}
          </div>

          {/* Reference Scripts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Reference Scripts</h3>
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
              >
                <Library size={16} />
                Browse Templates
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Add example scripts to help Claude learn your channel's writing style, tone, and structure.
            </p>
            <ReferenceScripts
              referenceScripts={formData.scriptSettings.referenceScripts}
              onChange={(scripts) => updateField('scriptSettings', 'referenceScripts', scripts)}
              maxScripts={6}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Prompt Template Library Modal */}
    {showPromptTemplates && (
      <PromptTemplateLibrary
        onClose={() => setShowPromptTemplates(false)}
        onSelect={handleSelectPromptTemplate}
        selectionMode={true}
      />
    )}

    {/* Person Video Selection Modal */}
    {showPersonVideoSelection && (
      <PersonVideoSelectionModal
        onClose={() => setShowPersonVideoSelection(false)}
        onConfirm={handlePersonVideoSelect}
        initialSettings={formData.visualSettings.type1.personVideoOverlay ? {
          video: formData.visualSettings.type1.personVideoOverlay,
          position: formData.visualSettings.type1.personVideoOverlay.position,
          scale: formData.visualSettings.type1.personVideoOverlay.scale,
          opacity: formData.visualSettings.type1.personVideoOverlay.opacity,
          chromaKey: formData.visualSettings.type1.personVideoOverlay.chromaKey,
        } : null}
      />
    )}

    {/* Sound Wave Selection Modal */}
    {showSoundWaveSelection && (
      <SoundWaveSelectionModal
        onClose={() => setShowSoundWaveSelection(false)}
        onConfirm={handleSoundWaveSelect}
        initialSettings={formData.visualSettings.type1.soundWaveOverlay ? {
          wave: formData.visualSettings.type1.soundWaveOverlay,
          position: formData.visualSettings.type1.soundWaveOverlay.position,
          scale: formData.visualSettings.type1.soundWaveOverlay.scale,
          opacity: formData.visualSettings.type1.soundWaveOverlay.opacity,
        } : null}
      />
    )}

    {/* Voice Clone Modal */}
    {showVoiceCloneModal && (
      <VoiceCloneModal
        onClose={() => setShowVoiceCloneModal(false)}
        onSelect={(clone) => {
          updateField('voiceSettings', 'voiceCloneId', clone.id);
          // Also update voice name for display
          updateField('voiceSettings', 'voice', clone.voice_name);
          // Update language based on voice clone tags
          const language = clone.tag_list?.[0] || 'English';
          updateField('voiceSettings', 'language', language);
          setShowVoiceCloneModal(false);
        }}
        initialSelection={formData.voiceSettings.voiceCloneId ? {
          id: formData.voiceSettings.voiceCloneId
        } : null}
      />
    )}

    {/* Person Video Pool Modal */}
    {showPersonVideoPoolModal && (
      <PersonVideoPoolModal
        onClose={() => setShowPersonVideoPoolModal(false)}
        onConfirm={(pool) => {
          updateField('visualSettings', 'type1', {
            ...formData.visualSettings.type1,
            personVideoPool: pool
          });
          setShowPersonVideoPoolModal(false);
        }}
        initialPool={formData.visualSettings.type1.personVideoPool}
      />
    )}

    </>
  );
};

export default ChannelForm;

