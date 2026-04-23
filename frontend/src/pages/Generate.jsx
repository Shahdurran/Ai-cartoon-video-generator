import { useState } from 'react';
import VideoGenerator from '../components/VideoGenerator';
import SimpleBatchProcessor from '../components/SimpleBatchProcessor';
import StepByStepVideoGenerator from '../components/StepByStepVideoGenerator';
import { Video, Layers, FileCheck } from 'lucide-react';

const Generate = ({ selectedChannel }) => {
  const [activeTab, setActiveTab] = useState('stepbystep');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Generate Videos</h1>
        
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('stepbystep')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === 'stepbystep'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileCheck size={20} />
            Step-by-Step (NEW!)
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === 'single'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Video size={20} />
            Quick Generate
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${
              activeTab === 'batch'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Layers size={20} />
            Batch Processing
          </button>
        </div>
      </div>

      {activeTab === 'stepbystep' ? (
        <StepByStepVideoGenerator selectedChannel={selectedChannel} />
      ) : activeTab === 'single' ? (
        <VideoGenerator selectedChannel={selectedChannel} />
      ) : (
        <SimpleBatchProcessor />
      )}
    </div>
  );
};

export default Generate;

