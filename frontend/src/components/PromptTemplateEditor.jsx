import { useState, useEffect } from 'react';
import { X, Save, FileText, AlertCircle, Eye, EyeOff } from 'lucide-react';

const PromptTemplateEditor = ({ template, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Custom',
    customPrompt: '',
    tone: 'neutral',
    length: 'medium',
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const predefinedCategories = [
    'History',
    'Science',
    'Education',
    'Entertainment',
    'Documentary',
    'Custom',
  ];

  const toneOptions = [
    'neutral',
    'dramatic',
    'educational',
    'informative',
    'mysterious',
    'energetic',
    'authoritative',
    'casual',
    'professional',
  ];

  const lengthOptions = [
    { value: 'short', label: 'Short (30-60s)' },
    { value: 'medium', label: 'Medium (60-120s)' },
    { value: 'long', label: 'Long (2-5min)' },
  ];

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        category: template.category || 'Custom',
        customPrompt: template.customPrompt || '',
        tone: template.tone || 'neutral',
        length: template.length || 'medium',
        tags: template.tags || [],
      });

      // Check if category is custom (not in predefined list)
      if (!predefinedCategories.includes(template.category)) {
        setShowCustomCategory(true);
        setCustomCategory(template.category);
      }
    }
  }, [template]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    
    const newTag = tagInput.trim().toLowerCase();
    if (!formData.tags.includes(newTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag],
      }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleCategoryChange = (value) => {
    if (value === 'new-custom') {
      setShowCustomCategory(true);
      setCustomCategory('');
    } else {
      setShowCustomCategory(false);
      handleChange('category', value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Template name is required');
      }
      if (!formData.customPrompt.trim()) {
        throw new Error('Template prompt is required');
      }

      // Use custom category if specified
      const finalCategory = showCustomCategory && customCategory.trim()
        ? customCategory.trim()
        : formData.category;

      const dataToSave = {
        ...formData,
        category: finalCategory,
      };

      await onSave(dataToSave);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getCharacterCount = () => {
    return formData.customPrompt.length;
  };

  const getWordCount = () => {
    return formData.customPrompt.trim().split(/\s+/).filter(w => w).length;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6" />
              {template ? 'Edit Template' : 'Create New Template'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {template?.isDefault
                ? 'System templates cannot be edited. This will create a copy.'
                : 'Define custom prompt instructions for script generation'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Template Name */}
            <div>
              <label className="block text-white font-medium mb-2">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., High Retention History"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            {/* Category and Tone Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Category
                </label>
                {showCustomCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter custom category"
                      className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomCategory(false);
                        handleChange('category', 'Custom');
                      }}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {predefinedCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new-custom">+ Create New Category</option>
                  </select>
                )}
              </div>

              {/* Tone */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Tone
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => handleChange('tone', e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {toneOptions.map(tone => (
                    <option key={tone} value={tone}>
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="block text-white font-medium mb-2">
                Target Length
              </label>
              <div className="grid grid-cols-3 gap-3">
                {lengthOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('length', option.value)}
                    className={`px-4 py-3 rounded-lg transition-colors ${
                      formData.length === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-white font-medium mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tags (press Enter)"
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-white font-medium">
                  Custom Prompt Instructions <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
              </div>
              
              <textarea
                value={formData.customPrompt}
                onChange={(e) => handleChange('customPrompt', e.target.value)}
                placeholder="Enter detailed instructions for how scripts should be generated with this template..."
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                rows={showPreview ? 10 : 20}
                required
              />
              
              <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
                <div>
                  {getWordCount()} words · {getCharacterCount()} characters
                </div>
                <div className="text-xs">
                  Variables: {'{TOPIC}'}, {'{TONE}'}, {'{LENGTH}'}
                </div>
              </div>

              {/* Preview */}
              {showPreview && formData.customPrompt && (
                <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs mb-2 font-semibold">PREVIEW:</div>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap">
                    {formData.customPrompt}
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-blue-900/20 border border-blue-500 text-blue-300 p-4 rounded-lg text-sm">
              <div className="font-semibold mb-2">💡 Template Tips:</div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Be specific about structure, style, and tone preferences</li>
                <li>Include examples of what you want (hooks, transitions, etc.)</li>
                <li>Define pacing and engagement techniques</li>
                <li>Specify any formatting or organizational requirements</li>
                <li>Use variables like {'{TOPIC}'}, {'{TONE}'}, {'{LENGTH}'} for dynamic content</li>
              </ul>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-750">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : template?.isDefault ? 'Save as New' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplateEditor;

