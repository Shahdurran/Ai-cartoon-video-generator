import { useState, useRef } from 'react';
import { Music, Plus, Trash2, GripVertical, Play, Pause, Volume2, X } from 'lucide-react';
import MusicSelectionModal from './MusicSelectionModal';

const MusicTracksEditor = ({ tracks = [], onChange, maxTracks = 5 }) => {
  const [showMusicSelection, setShowMusicSelection] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRefs = useRef([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAddTrack = () => {
    if (tracks.length >= maxTracks) {
      alert(`Maximum ${maxTracks} music tracks allowed`);
      return;
    }
    setEditingIndex(null); // Adding new track
    setShowMusicSelection(true);
  };

  const handleEditTrack = (index) => {
    setEditingIndex(index);
    setShowMusicSelection(true);
  };

  const handleSelectMusic = (music) => {
    const newTrack = {
      music,
      volume: 30,
      fadeIn: 2,
      fadeOut: 2,
      loop: true,
      startTime: 0, // When this track should start in the video (seconds)
      id: `track_${Date.now()}_${Math.random()}`,
    };

    let newTracks;
    if (editingIndex !== null) {
      // Editing existing track
      newTracks = [...tracks];
      newTracks[editingIndex] = {
        ...newTracks[editingIndex],
        music,
      };
    } else {
      // Adding new track
      newTracks = [...tracks, newTrack];
    }

    onChange(newTracks);
    setShowMusicSelection(false);
    setEditingIndex(null);
  };

  const handleRemoveTrack = (index) => {
    if (playingIndex === index) {
      audioRefs.current[index]?.pause();
      setPlayingIndex(null);
    }
    const newTracks = tracks.filter((_, i) => i !== index);
    onChange(newTracks);
  };

  const handleUpdateTrack = (index, field, value) => {
    const newTracks = [...tracks];
    newTracks[index] = {
      ...newTracks[index],
      [field]: value,
    };
    onChange(newTracks);
  };

  const handlePlayPause = (index) => {
    if (playingIndex === index) {
      audioRefs.current[index]?.pause();
      setPlayingIndex(null);
    } else {
      // Stop any currently playing track
      if (playingIndex !== null) {
        audioRefs.current[playingIndex]?.pause();
      }
      audioRefs.current[index]?.play();
      setPlayingIndex(index);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newTracks = [...tracks];
    const draggedTrack = newTracks[draggedIndex];
    
    // Remove from old position
    newTracks.splice(draggedIndex, 1);
    
    // Insert at new position
    newTracks.splice(dropIndex, 0, draggedTrack);
    
    onChange(newTracks);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-800">Background Music Tracks</h4>
          <p className="text-sm text-gray-600 mt-1">
            Add multiple music tracks that will play sequentially. Drag to reorder.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddTrack}
          disabled={tracks.length >= maxTracks}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          Add Track
        </button>
      </div>

      {/* Tracks List */}
      {tracks.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">No background music tracks added</p>
          <button
            type="button"
            onClick={handleAddTrack}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
          >
            Add First Track
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-white border-2 rounded-lg p-4 transition-all ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${
                draggedIndex !== null && draggedIndex !== index
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div className="cursor-move mt-2 text-gray-400 hover:text-gray-600">
                  <GripVertical size={20} />
                </div>

                {/* Track Number Badge */}
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-sm mt-1">
                  {index + 1}
                </div>

                {/* Track Content */}
                <div className="flex-1 space-y-3">
                  {/* Music Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-800">
                        {track.music.title || track.music.filename}
                      </h5>
                      {track.music.artist && track.music.artist !== 'Unknown Artist' && (
                        <p className="text-sm text-gray-600">{track.music.artist}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Duration: {formatDuration(track.music.duration)}</span>
                        <span>•</span>
                        <span>Starts at: {formatDuration(track.startTime)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayPause(index)}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                        title={playingIndex === index ? 'Pause' : 'Play'}
                      >
                        {playingIndex === index ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditTrack(index)}
                        className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded hover:bg-blue-50"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition"
                        title="Remove track"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Hidden Audio Element for Preview */}
                  <audio
                    ref={(el) => (audioRefs.current[index] = el)}
                    src={`http://localhost:3000/music-library/${track.music.filename}`}
                    onEnded={() => setPlayingIndex(null)}
                  />

                  {/* Track Settings */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
                    {/* Start Time */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Start Time (s)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={track.startTime}
                        onChange={(e) => handleUpdateTrack(index, 'startTime', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* Volume */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Volume ({track.volume}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={track.volume}
                        onChange={(e) => handleUpdateTrack(index, 'volume', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Fade In */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Fade In ({track.fadeIn}s)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={track.fadeIn}
                        onChange={(e) => handleUpdateTrack(index, 'fadeIn', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Fade Out */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Fade Out ({track.fadeOut}s)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={track.fadeOut}
                        onChange={(e) => handleUpdateTrack(index, 'fadeOut', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Loop Option */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={track.loop}
                      onChange={(e) => handleUpdateTrack(index, 'loop', e.target.checked)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded"
                    />
                    <span className="text-sm text-gray-700">Loop this track if video is longer</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Track Count */}
      {tracks.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          {tracks.length} of {maxTracks} tracks used
        </div>
      )}

      {/* Music Selection Modal */}
      <MusicSelectionModal
        isOpen={showMusicSelection}
        onClose={() => {
          setShowMusicSelection(false);
          setEditingIndex(null);
        }}
        onSelect={handleSelectMusic}
        currentSelection={editingIndex !== null ? tracks[editingIndex]?.music : null}
      />
    </div>
  );
};

export default MusicTracksEditor;

