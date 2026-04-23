import { useState, useEffect } from 'react';
import { 
  X, Search, Plus, FileText, Edit, Trash, Copy, 
  Download, Upload, Star, Lock, Tag, ChevronDown 
} from 'lucide-react';
import { promptTemplateAPI } from '../services/api';
import PromptTemplateEditor from './PromptTemplateEditor';

const PromptTemplateLibrary = ({ onClose, onSelect, selectionMode = false }) => {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [expandedTemplate, setExpandedTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, searchQuery]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await promptTemplateAPI.getAll();
      setTemplates(response.templates || []);
      setError(null);
    } catch (err) {
      setError('Failed to load templates: ' + err.message);
      console.error('Load templates error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await promptTemplateAPI.getCategories();
      setCategories(response.categories || []);
    } catch (err) {
      console.error('Load categories error:', err);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const nameMatch = t.name.toLowerCase().includes(query);
        const categoryMatch = t.category.toLowerCase().includes(query);
        const tagMatch = t.tags?.some(tag => tag.toLowerCase().includes(query));
        return nameMatch || categoryMatch || tagMatch;
      });
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template) => {
    if (template.isDefault) {
      // Can't edit default templates, duplicate instead
      handleDuplicate(template);
    } else {
      setEditingTemplate(template);
      setShowEditor(true);
    }
  };

  const handleDelete = async (template) => {
    if (template.isDefault) {
      alert('Cannot delete default templates');
      return;
    }

    if (!confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    try {
      await promptTemplateAPI.delete(template.id);
      await loadTemplates();
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  const handleDuplicate = async (template) => {
    const newName = prompt('Enter name for duplicated template:', `${template.name} (Copy)`);
    if (!newName) return;

    try {
      await promptTemplateAPI.duplicate(template.id, newName);
      await loadTemplates();
    } catch (err) {
      alert('Failed to duplicate template: ' + err.message);
    }
  };

  const handleExport = async (template) => {
    try {
      const response = await promptTemplateAPI.export(template.id);
      const dataStr = JSON.stringify(response.exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name.replace(/\s+/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export template: ' + err.message);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await promptTemplateAPI.import(data);
        await loadTemplates();
      } catch (err) {
        alert('Failed to import template: ' + err.message);
      }
    };
    input.click();
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      if (editingTemplate) {
        await promptTemplateAPI.update(editingTemplate.id, templateData);
      } else {
        await promptTemplateAPI.create(templateData);
      }
      await loadTemplates();
      setShowEditor(false);
      setEditingTemplate(null);
    } catch (err) {
      throw new Error('Failed to save template: ' + err.message);
    }
  };

  const handleSelectTemplate = (template) => {
    if (onSelect) {
      onSelect(template);
      if (onClose) onClose();
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'History': 'bg-blue-500',
      'Science': 'bg-green-500',
      'Education': 'bg-purple-500',
      'Entertainment': 'bg-pink-500',
      'Documentary': 'bg-yellow-500',
      'Custom': 'bg-gray-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  if (showEditor) {
    return (
      <PromptTemplateEditor
        template={editingTemplate}
        onClose={() => {
          setShowEditor(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Prompt Template Library
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {selectionMode ? 'Select a template for your video' : 'Manage your prompt templates'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-700 bg-gray-750">
          <div className="flex items-center gap-3 mb-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates by name, category, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Template
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading templates...</div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg">
              {error}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No templates found</p>
              <p className="text-sm mt-2">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first template to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="bg-gray-750 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all"
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold text-lg">
                          {template.name}
                        </h3>
                        {template.isDefault && (
                          <Lock className="w-4 h-4 text-yellow-500" title="System Template" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${getCategoryColor(template.category)} text-white text-xs px-2 py-1 rounded-full`}>
                          {template.category}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {template.tone} · {template.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="text-gray-500 text-xs px-2 py-1">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Preview */}
                  <div className="mb-4">
                    <p className="text-gray-400 text-sm line-clamp-3">
                      {template.customPrompt.substring(0, 150)}...
                    </p>
                    <button
                      onClick={() => setExpandedTemplate(
                        expandedTemplate === template.id ? null : template.id
                      )}
                      className="text-blue-400 hover:text-blue-300 text-xs mt-2 flex items-center gap-1"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${
                        expandedTemplate === template.id ? 'rotate-180' : ''
                      }`} />
                      {expandedTemplate === template.id ? 'Show less' : 'Show more'}
                    </button>
                    
                    {expandedTemplate === template.id && (
                      <div className="mt-3 p-3 bg-gray-800 rounded text-gray-300 text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {template.customPrompt}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
                    {selectionMode ? (
                      <button
                        onClick={() => handleSelectTemplate(template)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                      >
                        Use Template
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(template)}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center justify-center gap-1"
                          title={template.isDefault ? 'Duplicate to edit' : 'Edit'}
                        >
                          <Edit className="w-3 h-3" />
                          {template.isDefault ? 'Duplicate' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded text-sm transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExport(template)}
                          className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded text-sm transition-colors"
                          title="Export"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {!template.isDefault && (
                          <button
                            onClick={() => handleDelete(template)}
                            className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded text-sm transition-colors"
                            title="Delete"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-750">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              Showing {filteredTemplates.length} of {templates.length} templates
            </div>
            {!selectionMode && (
              <button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplateLibrary;

