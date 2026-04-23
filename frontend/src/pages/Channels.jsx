import { useState } from 'react';
import ChannelList from '../components/ChannelList';
import ChannelForm from '../components/ChannelForm';

const Channels = ({ onGenerate }) => {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (channel) => {
    setSelectedChannel(channel);
    setShowForm(true);
  };

  const handleNew = () => {
    setSelectedChannel(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedChannel(null);
  };

  const handleSave = () => {
    setShowForm(false);
    setSelectedChannel(null);
    // Trigger refresh by updating key
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div>
      <ChannelList
        key={refreshKey}
        onEdit={handleEdit}
        onGenerate={onGenerate}
        onNew={handleNew}
      />
      {showForm && (
        <ChannelForm
          channel={selectedChannel}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Channels;

