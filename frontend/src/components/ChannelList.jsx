import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Edit, Trash2, Plus } from 'lucide-react';
import { channelAPI } from '../services/api';

const ChannelList = ({ onEdit, onGenerate, onNew }) => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await channelAPI.getAll();
      setChannels(data.channels || []);
      setError(null);
    } catch (err) {
      setError('Failed to load channels: ' + err.message);
      console.error('Error loading channels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await channelAPI.delete(id);
      await loadChannels();
    } catch (err) {
      alert('Failed to delete channel: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading channels...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadChannels}
          className="mt-2 text-red-700 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Channels</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Channel
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No channels found</p>
          <button
            onClick={onNew}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Create your first channel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {channel.name}
                </h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {channel.type}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Voice:</span>{' '}
                  {channel.voiceSettings?.provider || 'N/A'} -{' '}
                  {channel.voiceSettings?.voice || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Style:</span>{' '}
                  {channel.visualSettings?.imageStyle || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Aspect Ratio:</span>{' '}
                  {channel.visualSettings?.aspectRatio || 'N/A'}
                </div>
                {channel.subtitleSettings?.fontFamily && (
                  <div>
                    <span className="font-medium">Font:</span>{' '}
                    {channel.subtitleSettings.fontFamily}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    onGenerate(channel);
                    navigate('/generate');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition"
                >
                  <Play size={16} />
                  Generate
                </button>
                <button
                  onClick={() => onEdit(channel)}
                  className="flex items-center justify-center gap-2 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(channel.id, channel.name)}
                  className="flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChannelList;

