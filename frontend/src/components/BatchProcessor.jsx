import { useState } from 'react';
import { Layers, Upload, AlertCircle } from 'lucide-react';
import { videoAPI } from '../services/api';

const BatchProcessor = () => {
  const [batchData, setBatchData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsedData = JSON.parse(batchData);
      const response = await videoAPI.batch(parsedData);
      setResult({
        ...response,
        jobs: response.jobId ? [response.jobId] : [],
      });
      setBatchData('');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your input.');
      } else {
        setError('Failed to process batch: ' + err.message);
      }
      console.error('Error processing batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    const example = {
      videos: [
        {
          channelId: 'your-channel-id',
          title: 'Video 1',
          context: 'First video context',
        },
        {
          channelId: 'your-channel-id',
          title: 'Video 2',
          context: 'Second video context',
        },
      ],
    };
    setBatchData(JSON.stringify(example, null, 2));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Layers className="text-purple-600" size={32} />
          <h2 className="text-2xl font-bold text-gray-800">Batch Processor</h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Batch Submitted Successfully!</h3>
            <p className="text-green-700 text-sm">
              {result.message || `${result.jobs?.length || 0} jobs added to queue`}
            </p>
            {result.jobs && result.jobs.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-green-800 mb-1">Job IDs:</p>
                <ul className="list-disc list-inside text-sm text-green-700">
                  {result.jobs.map((jobId) => (
                    <li key={jobId} className="font-mono">{jobId}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Batch JSON Data
              </label>
              <button
                type="button"
                onClick={loadExample}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Load Example
              </button>
            </div>
            <textarea
              value={batchData}
              onChange={(e) => setBatchData(e.target.value)}
              rows={15}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder='{\n  "channelId": "channel-id",\n  "videos": [\n    {\n      "title": "Video 1",\n      "context": "Context 1"\n    }\n  ]\n}'
            />
          </div>

          <button
            type="submit"
            disabled={loading || !batchData.trim()}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={20} />
            {loading ? 'Processing Batch...' : 'Submit Batch'}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {/* Batch Format */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-purple-800 mb-2">Batch Format:</h3>
          <pre className="text-sm text-purple-700 bg-white p-3 rounded border border-purple-200 overflow-x-auto">
{`{
  "videos": [
    {
      "channelId": "your-channel-id",
      "title": "Video Title 1",
      "context": "Video context or topic",
      "customPrompt": "Optional custom instructions"
    },
    {
      "channelId": "your-channel-id",
      "title": "Video Title 2",
      "context": "Another video context"
    }
  ]
}`}
          </pre>
        </div>

        {/* Person Overlay Pool Feature */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <span>🎲</span>
            Random Person Overlay Pool
          </h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>
              <strong>Create variety in batch videos!</strong> Configure a pool of person overlays in your channel settings.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Each video in your batch will randomly select a different person overlay</li>
              <li>Enable "Use Random Person Overlay Pool" in Channel Settings → Person Video Overlay section</li>
              <li>Add multiple person videos with their own position, scale, and chroma key settings</li>
              <li>Perfect for creating diverse content while maintaining consistent branding</li>
            </ul>
            <div className="mt-3 bg-white border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold mb-1">💡 Example Use Case:</p>
              <p className="text-xs">
                Add 5 different person videos (different poses/angles) to your pool. When generating 20 videos in a batch, 
                each video will randomly pick one overlay, creating natural variety across your content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchProcessor;

