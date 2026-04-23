const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { paths } = require('../config/paths.config');

class StorageService {
  constructor() {
    this.storagePath = paths.storage;
    this.locks = new Map(); // In-memory locks for write operations
    this.initializeStorage();
  }

  /**
   * Initialize storage directories
   */
  async initializeStorage() {
    const directories = [
      path.join(this.storagePath, 'channels'),
      path.join(this.storagePath, 'templates'),
      path.join(this.storagePath, 'projects'),
      path.join(this.storagePath, 'batches'),
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }

    console.log('✅ Storage directories initialized');
  }

  /**
   * Acquire lock for a file
   * @private
   */
  async _acquireLock(filePath, timeout = 5000) {
    const startTime = Date.now();
    
    while (this.locks.get(filePath)) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Lock timeout for ${filePath}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.locks.set(filePath, true);
  }

  /**
   * Release lock for a file
   * @private
   */
  _releaseLock(filePath) {
    this.locks.delete(filePath);
  }

  /**
   * Atomic write operation with backup
   * @private
   */
  async _atomicWrite(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.backup`;

    await this._acquireLock(filePath);

    try {
      // Create backup if file exists
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, backupPath);
      }

      // Write to temp file
      await fs.writeJson(tempPath, data, { spaces: 2 });

      // Atomic rename
      await fs.move(tempPath, filePath, { overwrite: true });

      // Clean up backup after successful write
      if (await fs.pathExists(backupPath)) {
        // Keep backup for a short time in case of issues
        setTimeout(async () => {
          try {
            await fs.remove(backupPath);
          } catch (err) {
            // Ignore cleanup errors
          }
        }, 60000); // Delete backup after 1 minute
      }
    } catch (error) {
      // Restore from backup if write failed
      if (await fs.pathExists(backupPath)) {
        await fs.move(backupPath, filePath, { overwrite: true });
      }
      throw error;
    } finally {
      this._releaseLock(filePath);
    }
  }

  /**
   * Save channel configuration with atomic write
   * @param {object} channelConfig - Channel configuration object
   * @returns {Promise<string>} Channel ID
   */
  async saveChannel(channelConfig) {
    const channelId = channelConfig.id || uuidv4();
    const channelData = {
      id: channelId,
      ...channelConfig,
      createdAt: channelConfig.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const channelPath = path.join(this.storagePath, 'channels', `${channelId}.json`);
    await this._atomicWrite(channelPath, channelData);

    console.log(`✅ Channel saved: ${channelId}`);
    return channelId;
  }

  /**
   * Get channel configuration
   * @param {string} channelId - Channel ID or name
   * @returns {Promise<object>} Channel configuration
   */
  async getChannel(channelId) {
    // First try to get by ID (UUID format or filename)
    const channelPath = path.join(this.storagePath, 'channels', `${channelId}.json`);
    
    if (await fs.pathExists(channelPath)) {
      return await fs.readJson(channelPath);
    }

    // If not found by ID, try to find by name (with or without type suffix)
    const channels = await this.listChannels();
    
    // Try exact match first
    let channelByName = channels.find(ch => ch.name === channelId || ch.id === channelId);
    
    // If not found and channelId contains " (TYPE_", try removing the type suffix
    if (!channelByName && channelId.includes(' (TYPE_')) {
      const nameWithoutType = channelId.replace(/\s*\(TYPE_\d+\)\s*$/, '').trim();
      channelByName = channels.find(ch => ch.name === nameWithoutType);
      if (channelByName) {
        console.log(`   ℹ️  Found channel by name "${nameWithoutType}" (stripped type from "${channelId}"), using ID: ${channelByName.id}`);
      }
    }
    
    if (channelByName) {
      if (!channelId.includes(' (TYPE_')) {
        console.log(`   ℹ️  Found channel by name "${channelId}", using ID: ${channelByName.id}`);
      }
      return channelByName;
    }

    throw new Error(`Channel not found: ${channelId}`);
  }

  /**
   * List all channels
   * @returns {Promise<array>} Array of channel configurations
   */
  async listChannels() {
    const channelsDir = path.join(this.storagePath, 'channels');
    const files = await fs.readdir(channelsDir);
    
    const channels = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const channelPath = path.join(channelsDir, file);
        const channel = await fs.readJson(channelPath);
        channels.push(channel);
      }
    }

    return channels;
  }

  /**
   * Delete channel
   * @param {string} channelId - Channel ID
   */
  async deleteChannel(channelId) {
    const channelPath = path.join(this.storagePath, 'channels', `${channelId}.json`);
    await fs.remove(channelPath);
    console.log(`✅ Channel deleted: ${channelId}`);
  }

  /**
   * Save template with atomic write
   * @param {object} template - Template object
   * @returns {Promise<string>} Template ID
   */
  async saveTemplate(template) {
    const templateId = template.id || uuidv4();
    const templateData = {
      id: templateId,
      ...template,
      createdAt: template.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const templatePath = path.join(this.storagePath, 'templates', `${templateId}.json`);
    await this._atomicWrite(templatePath, templateData);

    console.log(`✅ Template saved: ${templateId}`);
    return templateId;
  }

  /**
   * Get template
   * @param {string} templateId - Template ID
   * @returns {Promise<object>} Template object
   */
  async getTemplate(templateId) {
    const templatePath = path.join(this.storagePath, 'templates', `${templateId}.json`);
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return await fs.readJson(templatePath);
  }

  /**
   * List all templates
   * @returns {Promise<array>} Array of templates
   */
  async listTemplates() {
    const templatesDir = path.join(this.storagePath, 'templates');
    const files = await fs.readdir(templatesDir);
    
    const templates = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const templatePath = path.join(templatesDir, file);
        const template = await fs.readJson(templatePath);
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Save project with atomic write
   * @param {object} project - Project object
   * @returns {Promise<string>} Project ID
   */
  async saveProject(project) {
    const projectId = project.id || uuidv4();
    const projectData = {
      id: projectId,
      ...project,
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projectPath = path.join(this.storagePath, 'projects', `${projectId}.json`);
    await this._atomicWrite(projectPath, projectData);

    console.log(`✅ Project saved: ${projectId}`);
    return projectId;
  }

  /**
   * Get project
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} Project object
   */
  async getProject(projectId) {
    const projectPath = path.join(this.storagePath, 'projects', `${projectId}.json`);
    
    if (!await fs.pathExists(projectPath)) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return await fs.readJson(projectPath);
  }

  /**
   * List all projects
   * @returns {Promise<array>} Array of projects
   */
  async listProjects() {
    const projectsDir = path.join(this.storagePath, 'projects');
    const files = await fs.readdir(projectsDir);
    
    const projects = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const projectPath = path.join(projectsDir, file);
        const project = await fs.readJson(projectPath);
        projects.push(project);
      }
    }

    return projects;
  }

  /**
   * Save batch configuration with atomic write
   * @param {object} batch - Batch configuration
   * @returns {Promise<string>} Batch ID
   */
  async saveBatch(batch) {
    const batchId = batch.id || uuidv4();
    const batchData = {
      id: batchId,
      ...batch,
      createdAt: batch.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const batchPath = path.join(this.storagePath, 'batches', `${batchId}.json`);
    await this._atomicWrite(batchPath, batchData);

    console.log(`✅ Batch saved: ${batchId}`);
    return batchId;
  }

  /**
   * Get batch
   * @param {string} batchId - Batch ID
   * @returns {Promise<object>} Batch object
   */
  async getBatch(batchId) {
    const batchPath = path.join(this.storagePath, 'batches', `${batchId}.json`);
    
    if (!await fs.pathExists(batchPath)) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    return await fs.readJson(batchPath);
  }

  /**
   * Update batch status
   * @param {string} batchId - Batch ID
   * @param {object} statusUpdate - Status update object
   */
  async updateBatchStatus(batchId, statusUpdate) {
    const batch = await this.getBatch(batchId);
    const updatedBatch = {
      ...batch,
      ...statusUpdate,
      updatedAt: new Date().toISOString(),
    };

    await this.saveBatch(updatedBatch);
  }
}

module.exports = StorageService;

