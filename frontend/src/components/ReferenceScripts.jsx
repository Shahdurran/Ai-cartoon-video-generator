import { useState } from 'react';
import { Plus, X, BookOpen, FileText } from 'lucide-react';

const ReferenceScripts = ({ referenceScripts = [], onChange, maxScripts = 6, readOnly = false }) => {
  const [scripts, setScripts] = useState(referenceScripts);

  const addScript = () => {
    if (scripts.length >= maxScripts) return;
    
    const newScripts = [
      ...scripts,
      { title: '', content: '' }
    ];
    setScripts(newScripts);
    onChange(newScripts);
  };

  const updateScript = (index, field, value) => {
    const newScripts = scripts.map((script, i) => 
      i === index ? { ...script, [field]: value } : script
    );
    setScripts(newScripts);
    onChange(newScripts);
  };

  const removeScript = (index) => {
    const newScripts = scripts.filter((_, i) => i !== index);
    setScripts(newScripts);
    onChange(newScripts);
  };

  const getWordCount = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const getCharCount = (text) => {
    return text.length;
  };

  if (readOnly && scripts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="text-blue-600" size={20} />
          <h4 className="text-sm font-semibold text-gray-800">
            Reference Scripts {readOnly ? '' : `(${scripts.length}/${maxScripts})`}
          </h4>
        </div>
        {!readOnly && scripts.length < maxScripts && (
          <button
            type="button"
            onClick={addScript}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
          >
            <Plus size={16} />
            Add Script
          </button>
        )}
      </div>

      {!readOnly && scripts.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <FileText className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-sm text-gray-600 mb-3">
            Add reference scripts to help Claude learn your writing style and patterns.
          </p>
          <button
            type="button"
            onClick={addScript}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={16} />
            Add Your First Reference Script
          </button>
        </div>
      )}

      <div className="space-y-4">
        {scripts.map((script, index) => (
          <div
            key={index}
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-gray-600" size={16} />
                <span className="text-sm font-medium text-gray-700">
                  Reference Script {index + 1}
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeScript(index)}
                  className="text-red-500 hover:text-red-700 transition"
                  title="Remove script"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={script.title}
                onChange={(e) => updateScript(index, 'title', e.target.value)}
                readOnly={readOnly}
                placeholder="e.g., Example Historical Story Script"
                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  readOnly ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Script Content
              </label>
              <textarea
                value={script.content}
                onChange={(e) => updateScript(index, 'content', e.target.value)}
                readOnly={readOnly}
                rows={readOnly ? 4 : 6}
                placeholder="Paste your reference script here..."
                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  readOnly ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span>{getWordCount(script.content)} words</span>
                <span>{getCharCount(script.content)} characters</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && scripts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>Tip:</strong> Claude will analyze these scripts to learn your style, structure, and tone before generating new content.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReferenceScripts;

