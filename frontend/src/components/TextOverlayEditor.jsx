import { useState } from 'react';
import { Type, X, Edit2, Trash2, Plus, Eye } from 'lucide-react';

const TextOverlayEditor = ({ overlays = [], onChange, maxOverlays = 5 }) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [previewAnimation, setPreviewAnimation] = useState(false);

  const [formData, setFormData] = useState({
    text: '',
    position: 'bottom-right',
    font: {
      family: 'Arial',
      size: 32,
      color: '#FFFFFF',
      weight: 'normal',
    },
    background: {
      enabled: true,
      color: '#000000',
      opacity: 70,
      padding: 10,
    },
    timing: {
      type: 'entire',
      start: 0,
      end: 10,
    },
    animation: {
      type: 'none',
      duration: 0.5,
    },
  });

  const positions = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'middle-left', label: 'Middle Left' },
    { value: 'center', label: 'Center' },
    { value: 'middle-right', label: 'Middle Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-center', label: 'Bottom Center' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  const fonts = [
    'Arial',
    'Helvetica',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Poppins',
    'Impact',
    'Bebas Neue',
  ];

  const animations = [
    { value: 'none', label: 'None (Instant)' },
    { value: 'fade-in', label: 'Fade In' },
    { value: 'slide-left', label: 'Slide In from Right' },
    { value: 'slide-right', label: 'Slide In from Left' },
    { value: 'slide-top', label: 'Slide In from Bottom' },
    { value: 'slide-bottom', label: 'Slide In from Top' },
  ];

  const handleAdd = () => {
    setFormData({
      text: '',
      position: 'bottom-right',
      font: { family: 'Arial', size: 32, color: '#FFFFFF', weight: 'normal' },
      background: { enabled: true, color: '#000000', opacity: 70, padding: 10 },
      timing: { type: 'entire', start: 0, end: 10 },
      animation: { type: 'none', duration: 0.5 },
    });
    setEditingOverlay(null);
    setEditingIndex(-1);
    setShowEditor(true);
  };

  const handleEdit = (overlay, index) => {
    setFormData(overlay);
    setEditingOverlay(overlay);
    setEditingIndex(index);
    setShowEditor(true);
  };

  const handleDelete = (index) => {
    const newOverlays = overlays.filter((_, i) => i !== index);
    onChange(newOverlays);
  };

  const handleSave = () => {
    if (!formData.text.trim()) {
      alert('Text cannot be empty');
      return;
    }

    if (formData.timing.type === 'custom' && formData.timing.end <= formData.timing.start) {
      alert('End time must be greater than start time');
      return;
    }

    const newOverlay = {
      ...formData,
      id: editingOverlay ? editingOverlay.id : `overlay_${Date.now()}`,
    };

    let newOverlays;
    if (editingIndex >= 0) {
      // Update existing
      newOverlays = [...overlays];
      newOverlays[editingIndex] = newOverlay;
    } else {
      // Add new
      newOverlays = [...overlays, newOverlay];
    }

    onChange(newOverlays);
    setShowEditor(false);
    setEditingOverlay(null);
    setEditingIndex(-1);
  };

  const getPositionGridIndex = (position) => {
    const gridMap = {
      'top-left': 0,
      'top-center': 1,
      'top-right': 2,
      'middle-left': 3,
      'center': 4,
      'middle-right': 5,
      'bottom-left': 6,
      'bottom-center': 7,
      'bottom-right': 8,
    };
    return gridMap[position] || 8;
  };

  const getPreviewStyle = () => {
    const style = {
      fontFamily: formData.font.family,
      fontSize: `${formData.font.size}px`,
      color: formData.font.color,
      fontWeight: formData.font.weight === 'bold' ? 'bold' : formData.font.weight === 'black' ? '900' : 'normal',
      padding: formData.background.enabled ? `${formData.background.padding}px` : '0',
    };

    if (formData.background.enabled) {
      const opacity = formData.background.opacity / 100;
      style.backgroundColor = `${formData.background.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    }

    return style;
  };

  const getAnimationClass = () => {
    if (!previewAnimation || formData.animation.type === 'none') return '';
    return `animate-${formData.animation.type}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Custom Text Overlays</h3>
          <p className="text-xs text-gray-500 mt-1">
            {overlays.length}/{maxOverlays} overlays • Separate from subtitles
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={overlays.length >= maxOverlays}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <Plus size={16} />
          Add Overlay
        </button>
      </div>

      {/* Overlay List */}
      {overlays.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Type size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">No text overlays added yet</p>
          <p className="text-xs text-gray-500 mt-1">Add your first overlay to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overlays.map((overlay, index) => (
            <div key={overlay.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Type size={14} className="text-blue-600" />
                    <span className="font-medium text-sm text-gray-800">
                      {overlay.text.length > 60 ? `${overlay.text.substring(0, 60)}...` : overlay.text}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {positions.find((p) => p.value === overlay.position)?.label}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {overlay.timing.type === 'entire'
                        ? 'Entire Video'
                        : `${overlay.timing.start}s - ${overlay.timing.end}s`}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {overlay.font.family} {overlay.font.size}px
                    </span>
                    {overlay.animation.type !== 'none' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {animations.find((a) => a.value === overlay.animation.type)?.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(overlay, index)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingOverlay ? 'Edit Text Overlay' : 'Add Text Overlay'}
              </h3>
              <button
                onClick={() => setShowEditor(false)}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Text Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Content
                </label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value.substring(0, 500) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Enter your text overlay..."
                  maxLength="500"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.text.length}/500 characters</p>
              </div>

              {/* Position Grid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {positions.map((pos, index) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, position: pos.value })}
                      className={`p-3 border-2 rounded-lg text-sm transition ${
                        formData.position === pos.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                  <select
                    value={formData.font.family}
                    onChange={(e) =>
                      setFormData({ ...formData, font: { ...formData.font, family: e.target.value } })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font Weight</label>
                  <select
                    value={formData.font.weight}
                    onChange={(e) =>
                      setFormData({ ...formData, font: { ...formData.font, weight: e.target.value } })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="black">Black</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Size: {formData.font.size}px
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="96"
                    value={formData.font.size}
                    onChange={(e) =>
                      setFormData({ ...formData, font: { ...formData.font, size: parseInt(e.target.value) } })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font Color</label>
                  <input
                    type="color"
                    value={formData.font.color}
                    onChange={(e) =>
                      setFormData({ ...formData, font: { ...formData.font, color: e.target.value } })
                    }
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Background Settings */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={formData.background.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        background: { ...formData.background, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Background Box</span>
                </label>

                {formData.background.enabled && (
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Background Color
                      </label>
                      <input
                        type="color"
                        value={formData.background.color}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            background: { ...formData.background, color: e.target.value },
                          })
                        }
                        className="w-full h-10 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Opacity: {formData.background.opacity}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.background.opacity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            background: { ...formData.background, opacity: parseInt(e.target.value) },
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Padding: {formData.background.padding}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={formData.background.padding}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            background: { ...formData.background, padding: parseInt(e.target.value) },
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Timing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Timing</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.timing.type === 'entire'}
                      onChange={() => setFormData({ ...formData, timing: { ...formData.timing, type: 'entire' } })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Show entire video</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.timing.type === 'custom'}
                      onChange={() => setFormData({ ...formData, timing: { ...formData.timing, type: 'custom' } })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Custom time range</span>
                  </label>

                  {formData.timing.type === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start (seconds)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.timing.start}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              timing: { ...formData.timing, start: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End (seconds)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.timing.end}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              timing: { ...formData.timing, end: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {formData.timing.type === 'custom' && (
                        <p className="col-span-2 text-xs text-gray-500">
                          Duration: {Math.max(0, formData.timing.end - formData.timing.start).toFixed(1)} seconds
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Animation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Animation</label>
                <select
                  value={formData.animation.type}
                  onChange={(e) =>
                    setFormData({ ...formData, animation: { ...formData.animation, type: e.target.value } })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {animations.map((anim) => (
                    <option key={anim.value} value={anim.value}>
                      {anim.label}
                    </option>
                  ))}
                </select>

                {formData.animation.type !== 'none' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Animation Duration: {formData.animation.duration}s
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.1"
                      value={formData.animation.duration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          animation: { ...formData.animation, duration: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Preview</label>
                  {formData.animation.type !== 'none' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewAnimation(true);
                        setTimeout(() => setPreviewAnimation(false), formData.animation.duration * 1000 + 100);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition"
                    >
                      <Eye size={12} />
                      Play Animation
                    </button>
                  )}
                </div>
                <div className="bg-gray-800 rounded-lg p-8 flex items-center justify-center min-h-[150px]">
                  <div style={getPreviewStyle()} className={`${getAnimationClass()} inline-block`}>
                    {formData.text || 'Your text will appear here'}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {editingOverlay ? 'Update Overlay' : 'Add Overlay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextOverlayEditor;

