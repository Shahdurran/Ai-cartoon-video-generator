import { useState, useEffect } from 'react';
import { X, Clock, FileText, Mic, Image, CheckCircle, Search, Loader } from 'lucide-react';
import { videoAPI } from '../services/api';

const SessionHistoryModal = ({ channelId, onClose, onSelect }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadSessions();
  }, [channelId]);

  const loadSessions = async () => {
    if (!channelId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await videoAPI.getSessionsByChannel(channelId);
      setSessions(data.sessions || []);
    } catch (err) {
      setError(`Failed to load sessions: ${err.message}`);
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = async (sessionSummary) => {
    try {
      setLoading(true);
      // Get full session details
      const data = await videoAPI.getSessionDetails(sessionSummary.sessionId);
      setSelectedSession(data.session);
    } catch (err) {
      setError(`Failed to load session details: ${err.message}`);
      console.error('Error loading session details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSession = () => {
    if (selectedSession) {
      onSelect(selectedSession);
      onClose();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Previous Scripts & Voiceovers</h2>
            <p className="text-sm text-gray-600 mt-1">Select a previous session to reuse its script and voice</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sessions List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {loading && !selectedSession ? (
              <div className="flex items-center justify-center h-64">
                <Loader className="animate-spin text-blue-600" size={32} />
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <div className="text-red-600">{error}</div>
                <button
                  onClick={loadSessions}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm ? 'No sessions match your search' : 'No previous sessions found'}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition ${
                      selectedSession?.sessionId === session.sessionId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 line-clamp-1">{session.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        session.status === 'ready_for_video' ? 'bg-green-100 text-green-800' :
                        session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(session.createdAt)}
                      </div>
                      {session.audioDuration && (
                        <div className="flex items-center gap-1">
                          <Mic size={12} />
                          {formatDuration(session.audioDuration)}
                        </div>
                      )}
                      {session.wordCount && (
                        <div className="flex items-center gap-1">
                          <FileText size={12} />
                          {session.wordCount} words
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {session.hasScript && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          <CheckCircle size={12} />
                          Script
                        </span>
                      )}
                      {session.hasVoice && (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          <CheckCircle size={12} />
                          Voice
                        </span>
                      )}
                      {session.hasImages && (
                        <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          <CheckCircle size={12} />
                          Images
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session Details */}
          <div className="w-1/2 overflow-y-auto">
            {selectedSession ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Details</h3>
                
                {/* Title */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-600">Title</label>
                  <p className="text-gray-800 mt-1">{selectedSession.title}</p>
                </div>
                
                {/* Script */}
                {selectedSession.script && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-600">Script</label>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{selectedSession.script.wordCount} words</span>
                        <span>•</span>
                        <span>{selectedSession.script.estimatedDuration}s</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedSession.script.script}</p>
                    </div>
                  </div>
                )}
                
                {/* Voice */}
                {selectedSession.voice && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">Voice Narration</label>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm text-green-800 mb-2">
                        <CheckCircle size={16} />
                        <span>Voice generated ({formatDuration(selectedSession.voice.duration)})</span>
                      </div>
                      <audio
                        controls
                        className="w-full"
                        src={`http://localhost:3000${selectedSession.voice.audioPath?.replace(/\\/g, '/').replace(/^.*temp/, '/temp')}`}
                      />
                    </div>
                  </div>
                )}
                
                {/* Images */}
                {selectedSession.images && selectedSession.images.length > 0 && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">
                      Generated Images ({selectedSession.images.length})
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedSession.images.slice(0, 6).map((img, idx) => (
                        <div key={idx} className="aspect-video bg-gray-100 rounded overflow-hidden">
                          <img
                            src={`http://localhost:3000${img.path?.replace(/\\/g, '/').replace(/^.*temp/, '/temp')}`}
                            alt={`Image ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    {selectedSession.images.length > 6 && (
                      <p className="text-xs text-gray-500 mt-2">
                        +{selectedSession.images.length - 6} more images
                      </p>
                    )}
                  </div>
                )}
                
                {/* Created Date */}
                <div className="text-xs text-gray-500 mt-4">
                  Created: {new Date(selectedSession.createdAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-4" />
                  <p>Select a session to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUseSession}
            disabled={!selectedSession}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use This Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionHistoryModal;

