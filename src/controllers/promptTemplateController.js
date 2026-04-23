const PromptTemplateService = require('../services/promptTemplateService');

class PromptTemplateController {
  /**
   * Get all prompt templates
   */
  static async getAllTemplates(req, res) {
    try {
      const service = new PromptTemplateService();
      const templates = await service.getAllTemplates();

      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error) {
      console.error('Get all templates error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplate(req, res) {
    try {
      const { id } = req.params;
      const service = new PromptTemplateService();
      const template = await service.getTemplateById(id);

      res.json({
        success: true,
        template,
      });
    } catch (error) {
      console.error('Get template error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Get all categories
   */
  static async getCategories(req, res) {
    try {
      const service = new PromptTemplateService();
      const categories = await service.getCategories();

      res.json({
        success: true,
        categories,
        count: categories.length,
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get templates by category
   */
  static async getTemplatesByCategory(req, res) {
    try {
      const { category } = req.params;
      const service = new PromptTemplateService();
      const templates = await service.getTemplatesByCategory(category);

      res.json({
        success: true,
        category,
        templates,
        count: templates.length,
      });
    } catch (error) {
      console.error('Get templates by category error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create a new template
   */
  static async createTemplate(req, res) {
    try {
      const templateData = req.body;
      const service = new PromptTemplateService();
      const template = await service.createTemplate(templateData);

      res.json({
        success: true,
        template,
        message: 'Template created successfully',
      });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Update a template
   */
  static async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const service = new PromptTemplateService();
      const template = await service.updateTemplate(id, updates);

      res.json({
        success: true,
        template,
        message: 'Template updated successfully',
      });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const service = new PromptTemplateService();
      const template = await service.deleteTemplate(id);

      res.json({
        success: true,
        message: 'Template deleted successfully',
        deletedTemplate: template,
      });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Duplicate a template
   */
  static async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const service = new PromptTemplateService();
      const template = await service.duplicateTemplate(id, name);

      res.json({
        success: true,
        template,
        message: 'Template duplicated successfully',
      });
    } catch (error) {
      console.error('Duplicate template error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Search templates
   */
  static async searchTemplates(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const service = new PromptTemplateService();
      const templates = await service.searchTemplates(q);

      res.json({
        success: true,
        query: q,
        templates,
        count: templates.length,
      });
    } catch (error) {
      console.error('Search templates error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Export template
   */
  static async exportTemplate(req, res) {
    try {
      const { id } = req.params;
      const service = new PromptTemplateService();
      const exportData = await service.exportTemplate(id);

      res.json({
        success: true,
        exportData,
      });
    } catch (error) {
      console.error('Export template error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Import template
   */
  static async importTemplate(req, res) {
    try {
      const importData = req.body;
      const service = new PromptTemplateService();
      const template = await service.importTemplate(importData);

      res.json({
        success: true,
        template,
        message: 'Template imported successfully',
      });
    } catch (error) {
      console.error('Import template error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = PromptTemplateController;

