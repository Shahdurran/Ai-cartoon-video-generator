const StorageService = require('../services/storageService');

class ChannelController {
  /**
   * Create a new channel configuration
   */
  static async createChannel(req, res) {
    try {
      const channelConfig = req.body;

      if (!channelConfig.name) {
        return res.status(400).json({ error: 'Channel name is required' });
      }

      const storageService = new StorageService();
      const channelId = await storageService.saveChannel(channelConfig);

      res.json({
        success: true,
        channelId,
        message: 'Channel created successfully',
      });
    } catch (error) {
      console.error('Create channel error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get channel by ID
   */
  static async getChannel(req, res) {
    try {
      const { channelId } = req.params;

      const storageService = new StorageService();
      const channel = await storageService.getChannel(channelId);

      res.json({
        success: true,
        channel,
      });
    } catch (error) {
      console.error('Get channel error:', error);
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * List all channels
   */
  static async listChannels(req, res) {
    try {
      const storageService = new StorageService();
      const channels = await storageService.listChannels();

      res.json({
        success: true,
        channels,
        count: channels.length,
      });
    } catch (error) {
      console.error('List channels error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update channel configuration
   */
  static async updateChannel(req, res) {
    try {
      const { channelId } = req.params;
      const updates = req.body;

      const storageService = new StorageService();
      
      // Get existing channel
      const channel = await storageService.getChannel(channelId);
      
      // Merge updates
      const updatedChannel = {
        ...channel,
        ...updates,
        id: channelId, // Ensure ID doesn't change
      };

      await storageService.saveChannel(updatedChannel);

      res.json({
        success: true,
        message: 'Channel updated successfully',
        channel: updatedChannel,
      });
    } catch (error) {
      console.error('Update channel error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete channel
   */
  static async deleteChannel(req, res) {
    try {
      const { channelId } = req.params;

      const storageService = new StorageService();
      await storageService.deleteChannel(channelId);

      res.json({
        success: true,
        message: 'Channel deleted successfully',
        channelId,
      });
    } catch (error) {
      console.error('Delete channel error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create a template
   */
  static async createTemplate(req, res) {
    try {
      const template = req.body;

      if (!template.name) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      const storageService = new StorageService();
      const templateId = await storageService.saveTemplate(template);

      res.json({
        success: true,
        templateId,
        message: 'Template created successfully',
      });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * List all templates
   */
  static async listTemplates(req, res) {
    try {
      const storageService = new StorageService();
      const templates = await storageService.listTemplates();

      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error) {
      console.error('List templates error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const storageService = new StorageService();
      const template = await storageService.getTemplate(templateId);

      res.json({
        success: true,
        template,
      });
    } catch (error) {
      console.error('Get template error:', error);
      res.status(404).json({ error: error.message });
    }
  }
}

module.exports = ChannelController;

