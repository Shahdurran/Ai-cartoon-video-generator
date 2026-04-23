import { useState, useEffect } from 'react';
import { Layers, Upload, Download, AlertCircle, CheckCircle, FileText, List } from 'lucide-react';
import { videoAPI, channelAPI } from '../services/api';

const SimpleBatchProcessor = () => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [inputMethod, setInputMethod] = useState('textarea'); // 'textarea' or 'csv'
  const [textareaInput, setTextareaInput] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Duration range settings
  const [useDurationRange, setUseDurationRange] = useState(false);
  const [minDuration, setMinDuration] = useState(30);
  const [maxDuration, setMaxDuration] = useState(120);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const response = await channelAPI.getAll();
      setChannels(response.channels || []);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'Title,Context\nThe Fall of Rome,Focus on economic collapse and military decline\nViking Age Exploration,Norse voyages to North America\nAncient Egyptian Pyramids,Construction techniques and workforce';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batch-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const videos = [];
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handles basic cases)
      const match = line.match(/^"?([^",]+)"?,\s*"?([^"]*)"?$/);
      if (match) {
        videos.push({
          title: match[1].trim(),
          context: match[2].trim()
        });
      } else {
        // Try splitting by comma
        const parts = line.split(',');
        if (parts.length >= 1) {
          videos.push({
            title: parts[0].trim(),
            context: parts[1]?.trim() || ''
          });
        }
      }
    }
    return videos;
  };

  const parseTextarea = (text) => {
    const lines = text.trim().split('\n');
    const videos = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if line contains | separator
      if (trimmed.includes('|')) {
        const [title, context] = trimmed.split('|').map(s => s.trim());
        videos.push({ title, context: context || '' });
      } else {
        videos.push({ title: trimmed, context: '' });
      }
    }
    
    return videos;
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const videos = parseCSV(text);
      setCsvPreview(videos);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      const fakeEvent = { target: { files: [file] } };
      handleCSVUpload(fakeEvent);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getVideosFromInput = () => {
    if (inputMethod === 'csv' && csvPreview) {
      return csvPreview;
    } else if (inputMethod === 'textarea' && textareaInput) {
      return parseTextarea(textareaInput);
    }
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!selectedChannel) {
        throw new Error('Please select a channel');
      }

      const videos = getVideosFromInput();
      
      if (videos.length === 0) {
        throw new Error('Please add at least one video');
      }

      // Validate duration range if enabled
      if (useDurationRange) {
        if (minDuration >= maxDuration) {
          throw new Error('Minimum duration must be less than maximum duration');
        }
        if (minDuration < 10 || maxDuration > 600) {
          throw new Error('Duration must be between 10 and 600 seconds');
        }
      }

      // Add channelId and customPrompt to each video
      const batchData = {
        videos: videos.map(v => {
          const videoConfig = {
            channelId: selectedChannel,
            title: v.title,
            context: v.context,
            ...(customPrompt && { customPrompt })
          };

          // Add random duration if enabled
          if (useDurationRange) {
            const randomDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
            videoConfig.targetDuration = randomDuration;
            console.log(`Video "${v.title}" assigned duration: ${randomDuration}s`);
          }

          return videoConfig;
        })
      };

      const response = await videoAPI.batch(batchData);
      setResult({
        success: true,
        count: videos.length,
        batchId: response.batchId,
        message: response.message
      });
      
      // Clear inputs
      setTextareaInput('');
      setCsvFile(null);
      setCsvPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to process batch');
      console.error('Error processing batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const videoCount = getVideosFromInput().length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Layers className="text-purple-600" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Simple Batch Processor</h2>
            <p className="text-sm text-gray-600">Generate multiple videos at once - no JSON required!</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-green-800 mb-1">Batch Submitted Successfully!</h3>
                <p className="text-green-700 text-sm mb-2">
                  {result.count} videos added to generation queue
                </p>
                {result.batchId && (
                  <p className="text-xs text-green-600 font-mono">Batch ID: {result.batchId}</p>
                )}
                <a
                  href="/queue"
                  className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  View progress in Queue Monitor →
                </a>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. Select Channel <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              <option value="">Choose a channel...</option>
              {channels.map((channel) => (
                <option key={channel._id} value={channel._id}>
                  {channel.name} ({channel.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              All videos will use this channel's settings (voice, visuals, subtitles, etc.)
            </p>
          </div>

          {/* Input Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              2. Choose Input Method
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setInputMethod('textarea')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                  inputMethod === 'textarea'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <List size={20} />
                Quick Text Entry
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('csv')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                  inputMethod === 'csv'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText size={20} />
                CSV Upload
              </button>
            </div>
          </div>

          {/* Textarea Input */}
          {inputMethod === 'textarea' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3. Enter Video Titles
              </label>
              <textarea
                value={textareaInput}
                onChange={(e) => setTextareaInput(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter one title per line. Optionally add context after | symbol:

The Fall of Rome | Economic collapse and military decline
Viking Age Exploration | Norse voyages to North America
Ancient Egyptian Pyramids
Renaissance Art in Italy | Focus on Leonardo da Vinci"
              />
              <p className="text-xs text-gray-500 mt-1">
                {videoCount > 0 ? `${videoCount} video${videoCount > 1 ? 's' : ''} ready to generate` : 'Enter at least one video title'}
              </p>
            </div>
          )}

          {/* CSV Upload */}
          {inputMethod === 'csv' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3. Upload CSV File
              </label>
              
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition"
              >
                <Upload className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-700 mb-2">
                  Drag & drop your CSV file here, or
                </p>
                <label className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  Choose File
                </label>
                
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="text-sm text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mx-auto"
                  >
                    <Download size={14} />
                    Download CSV Template
                  </button>
                </div>
              </div>

              {csvFile && (
                <div className="mt-3 text-sm text-gray-600">
                  Selected: <span className="font-medium">{csvFile.name}</span>
                </div>
              )}

              {csvPreview && csvPreview.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">Preview ({csvPreview.length} videos):</h4>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">#</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Title</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((video, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="px-4 py-2 text-gray-600">{index + 1}</td>
                            <td className="px-4 py-2 text-gray-800">{video.title}</td>
                            <td className="px-4 py-2 text-gray-600">{video.context || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration Range (Optional) */}
          <div className="border border-gray-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="useDurationRange"
                checked={useDurationRange}
                onChange={(e) => setUseDurationRange(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="useDurationRange" className="text-sm font-medium text-gray-700">
                4. Enable Dynamic Video Duration Range (Optional)
              </label>
            </div>

            {useDurationRange && (
              <div className="ml-6 space-y-3">
                <p className="text-xs text-gray-600 mb-3">
                  Each video will be assigned a random duration within the range. The script will be adjusted to match the target duration.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Minimum Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="600"
                      value={minDuration}
                      onChange={(e) => setMinDuration(parseInt(e.target.value) || 10)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">{Math.floor(minDuration / 60)}:{(minDuration % 60).toString().padStart(2, '0')} min</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Maximum Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="600"
                      value={maxDuration}
                      onChange={(e) => setMaxDuration(parseInt(e.target.value) || 120)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">{Math.floor(maxDuration / 60)}:{(maxDuration % 60).toString().padStart(2, '0')} min</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                  <strong>Range:</strong> {minDuration}s - {maxDuration}s ({maxDuration - minDuration}s variation)
                </div>
              </div>
            )}
          </div>

          {/* Custom Prompt (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5. Custom Prompt (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Add custom instructions for all videos in this batch (e.g., 'Make it engaging and dramatic', 'Use simple language for beginners')"
            />
            <p className="text-xs text-gray-500 mt-1">
              This prompt will be applied to all videos. Channel's script settings will still be used.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedChannel || videoCount === 0}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            <Upload size={20} />
            {loading ? 'Processing Batch...' : `Generate ${videoCount} Video${videoCount !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>

      {/* Format Guide */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <List size={18} />
            Quick Text Entry Format
          </h3>
          <pre className="text-sm text-blue-700 bg-white p-3 rounded border border-blue-200 overflow-x-auto">
{`One title per line:
Title 1
Title 2

With optional context:
Title 1 | Context for video 1
Title 2 | Context for video 2`}
          </pre>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
            <FileText size={18} />
            CSV Format
          </h3>
          <pre className="text-sm text-green-700 bg-white p-3 rounded border border-green-200 overflow-x-auto">
{`Title,Context
The Fall of Rome,Economic collapse
Viking Age,Norse exploration
Ancient Egypt,Pyramid construction`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SimpleBatchProcessor;
