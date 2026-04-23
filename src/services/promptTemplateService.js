const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { paths } = require('../config/paths.config');

class PromptTemplateService {
  constructor() {
    this.templatesFile = path.join(paths.storage, 'prompt-templates.json');
    this.locks = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize templates file with defaults if it doesn't exist
   */
  async initializeTemplates() {
    try {
      await fs.ensureDir(paths.storage);
      
      if (!await fs.pathExists(this.templatesFile)) {
        console.log('📝 Creating default prompt templates...');
        const defaultTemplates = this._getDefaultTemplates();
        await this._writeTemplates(defaultTemplates);
        console.log(`✅ Created ${defaultTemplates.length} default prompt templates`);
      } else {
        // Ensure default templates are present (in case file was manually edited)
        await this._ensureDefaultTemplatesExist();
      }
    } catch (error) {
      console.error('❌ Error initializing prompt templates:', error);
    }
  }

  /**
   * Get default system templates
   * @private
   */
  _getDefaultTemplates() {
    const now = new Date().toISOString();
    
    return [
      {
        id: 'default-high-retention',
        name: 'High Retention Storytelling',
        category: 'Entertainment',
        customPrompt: `Create a highly engaging, retention-focused video script that:

1. HOOK (First 3 seconds): Start with an irresistible hook - a shocking statement, intriguing question, or bold claim that makes viewers NEED to keep watching.

2. PATTERN INTERRUPTS: Every 8-12 seconds, introduce something new:
   - A surprising fact
   - A plot twist
   - A rhetorical question
   - An emotional beat
   - A cliffhanger that builds to the next section

3. PACING:
   - Use short, punchy sentences
   - Vary sentence length for rhythm
   - Create mini-cliffhangers before transitions
   - Never let energy drop

4. EMOTIONAL JOURNEY:
   - Build curiosity early
   - Escalate tension gradually
   - Deliver satisfying payoffs
   - End with impact that makes viewers want more

5. VISUAL LANGUAGE:
   - Write cinematically - every sentence should paint a picture
   - Use active, vivid verbs
   - Describe scenes that evoke emotion

RETENTION TECHNIQUES:
- Open loops (hint at information you'll reveal later)
- Social proof ("millions of people don't know this...")
- Relatability ("we've all experienced...")
- Urgency ("but here's what changes everything...")

The goal: Keep viewers watching until the very last second.`,
        tone: 'dramatic',
        length: 'medium',
        tags: ['high-retention', 'viral', 'engaging', 'storytelling', 'hooks'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-educational',
        name: 'Educational Deep Dive',
        category: 'Education',
        customPrompt: `Create a clear, educational video script that:

1. CLEAR HOOK: Start with a relatable problem or fascinating question that the video will answer.

2. LOGICAL STRUCTURE:
   - Introduction: State what viewers will learn
   - Foundation: Build from simple concepts to complex
   - Examples: Provide concrete, relatable examples
   - Practical Application: Show how to use this knowledge
   - Summary: Reinforce key takeaways

3. TEACHING TECHNIQUES:
   - Use analogies and metaphors
   - Break complex ideas into simple steps
   - Repeat key concepts in different ways
   - Connect new information to what viewers already know

4. ENGAGEMENT STRATEGIES:
   - Ask rhetorical questions to prompt thinking
   - Use "imagine this..." scenarios
   - Provide "aha moment" revelations
   - Address common misconceptions

5. CLARITY:
   - Define technical terms when introduced
   - Use simple language without dumbing down
   - One main idea per sentence
   - Smooth transitions between concepts

EDUCATIONAL GOALS:
- Viewers should understand AND remember
- Make complex topics accessible
- Inspire curiosity for deeper learning
- Provide actionable knowledge`,
        tone: 'informative',
        length: 'long',
        tags: ['educational', 'tutorial', 'learning', 'teaching', 'informative'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-dramatic-history',
        name: 'Dramatic History',
        category: 'History',
        customPrompt: `Create an epic, dramatic historical narrative that:

1. EPIC OPENING: Begin with the moment of greatest drama, then rewind to build context.

2. STORYTELLING APPROACH:
   - Write like a thriller, not a textbook
   - Focus on human stories and emotions
   - Build tension toward pivotal moments
   - Use vivid, sensory descriptions

3. NARRATIVE TECHNIQUES:
   - Present tense for immediacy ("It's 1944. The tide is turning...")
   - Dramatic irony (reveal what historical figures didn't know)
   - Foreshadowing ("Little did they know...")
   - Cinematic scene-setting

4. EMOTIONAL RESONANCE:
   - Highlight human stakes and consequences
   - Show the weight of decisions
   - Capture the zeitgeist of the era
   - Connect past to present impact

5. HISTORICAL ACCURACY:
   - Ground drama in verified facts
   - Acknowledge historical debates when relevant
   - Provide context for decisions and events

DRAMATIC ELEMENTS:
- Character-driven narratives (historical figures as protagonists)
- Rising action and climactic moments
- Moral complexity and difficult choices
- Legacy and lasting impact

Make history feel urgent, relevant, and impossible to look away from.`,
        tone: 'dramatic',
        length: 'medium',
        tags: ['history', 'dramatic', 'storytelling', 'narrative', 'epic'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-mystery',
        name: 'Mystery & Intrigue',
        category: 'Entertainment',
        customPrompt: `Create a mysterious, suspenseful video script that:

1. MYSTERIOUS HOOK: Start with an unsettling question, strange occurrence, or unexplained phenomenon.

2. SUSPENSE BUILDING:
   - Reveal information gradually, piece by piece
   - Plant questions in viewers' minds
   - Use strategic pauses and moments of silence
   - Build to revelations slowly

3. NARRATIVE STRUCTURE:
   - Layer mysteries (solve small questions to reach bigger ones)
   - Use red herrings and misdirection
   - Create "wait, what?" moments
   - Save the biggest reveal for the end

4. ATMOSPHERIC WRITING:
   - Use mood-setting language
   - Create unease and curiosity
   - Employ cliffhangers between sections
   - Write in a way that builds anticipation

5. PACING:
   - Start with intrigue, not exposition
   - Escalate the strangeness
   - Deliver satisfying explanations
   - Leave room for wonder

MYSTERY TECHNIQUES:
- "But here's where it gets strange..."
- "What they found next would change everything..."
- "The truth was far more disturbing..."
- Present evidence before conclusions

Keep viewers on the edge of their seats, constantly wondering what comes next.`,
        tone: 'mysterious',
        length: 'medium',
        tags: ['mystery', 'suspense', 'intrigue', 'thriller', 'investigation'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-fast-paced',
        name: 'Fast-Paced Entertainment',
        category: 'Entertainment',
        customPrompt: `Create a rapid-fire, high-energy video script that:

1. INSTANT HOOK: First sentence must be a banger. No warmup. Jump straight into the action.

2. PACING:
   - Short sentences. Quick cuts. Constant movement.
   - New information every 3-5 seconds
   - No filler. Every word earns its place.
   - Maintain relentless forward momentum

3. ENERGY:
   - Use active voice exclusively
   - Power verbs and dynamic language
   - Present tense for immediacy
   - Exclamation points for emphasis (but don't overdo it)

4. STRUCTURE:
   - List format works great (Top 5, 3 ways, etc.)
   - Countdown format builds anticipation
   - Rapid-fire facts with quick transitions
   - Save the best for last to maintain retention

5. MODERN STYLE:
   - Conversational, almost breathless delivery
   - Internet culture references when appropriate
   - "Wait for it..." and callback moments
   - Self-aware humor

ENERGY BOOSTERS:
- "But wait, it gets crazier..."
- "And here's the best part..."
- "Plot twist:"
- "You won't believe what happened next..."

This should feel like scrolling through the most interesting content feed ever. Fast, fun, and impossible to pause.`,
        tone: 'energetic',
        length: 'short',
        tags: ['fast-paced', 'energetic', 'viral', 'trending', 'quick'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'default-documentary',
        name: 'Documentary Style',
        category: 'Documentary',
        customPrompt: `Create a professional, documentary-style video script that:

1. AUTHORITATIVE OPENING: Begin with a thesis statement or compelling question grounded in research.

2. JOURNALISTIC APPROACH:
   - Objective tone, let facts speak
   - Multiple perspectives when appropriate
   - Evidence-based statements
   - Clear sourcing ("According to researchers...", "Studies show...")

3. NARRATIVE STRUCTURE:
   - Context and background first
   - Present information logically
   - Build from foundation to deeper insights
   - Explore implications and consequences

4. DOCUMENTARY TECHNIQUES:
   - Observational descriptions
   - Expert insights woven in naturally
   - Data and statistics for credibility
   - Balance information with storytelling

5. DEPTH AND NUANCE:
   - Acknowledge complexity
   - Address counterarguments
   - Provide historical context
   - Connect micro to macro (personal stories to bigger picture)

DOCUMENTARY QUALITIES:
- Thoughtful pacing (let important moments breathe)
- Measured, confident narration style
- Visual storytelling cues
- Reflective conclusions that invite thought

CREDIBILITY MARKERS:
- Specific dates, numbers, and names
- "Research shows..." or "Experts believe..."
- Avoiding speculation (or clearly labeling it)
- Balanced presentation of different viewpoints

Create content that feels PBS/BBC quality - informative, authoritative, and deeply engaging.`,
        tone: 'authoritative',
        length: 'long',
        tags: ['documentary', 'professional', 'research', 'authoritative', 'in-depth'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  /**
   * Ensure default templates exist (merge with existing)
   * @private
   */
  async _ensureDefaultTemplatesExist() {
    try {
      const templates = await this._readTemplates();
      const defaultTemplates = this._getDefaultTemplates();
      
      let needsUpdate = false;
      
      for (const defaultTemplate of defaultTemplates) {
        const exists = templates.some(t => t.id === defaultTemplate.id);
        if (!exists) {
          templates.push(defaultTemplate);
          needsUpdate = true;
          console.log(`  + Added default template: ${defaultTemplate.name}`);
        }
      }
      
      if (needsUpdate) {
        await this._writeTemplates(templates);
        console.log('✅ Updated prompt templates with defaults');
      }
    } catch (error) {
      console.error('Error ensuring default templates:', error);
    }
  }

  /**
   * Read templates from file
   * @private
   */
  async _readTemplates() {
    try {
      if (!await fs.pathExists(this.templatesFile)) {
        return [];
      }
      return await fs.readJson(this.templatesFile);
    } catch (error) {
      console.error('Error reading templates:', error);
      return [];
    }
  }

  /**
   * Write templates to file with atomic operation
   * @private
   */
  async _writeTemplates(templates) {
    const tempPath = `${this.templatesFile}.tmp`;
    const backupPath = `${this.templatesFile}.backup`;

    try {
      // Create backup if file exists
      if (await fs.pathExists(this.templatesFile)) {
        await fs.copy(this.templatesFile, backupPath);
      }

      // Write to temp file
      await fs.writeJson(tempPath, templates, { spaces: 2 });

      // Atomic rename
      await fs.move(tempPath, this.templatesFile, { overwrite: true });

      // Clean up backup after successful write
      setTimeout(async () => {
        try {
          if (await fs.pathExists(backupPath)) {
            await fs.remove(backupPath);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 60000);
    } catch (error) {
      // Restore from backup if write failed
      if (await fs.pathExists(backupPath)) {
        await fs.move(backupPath, this.templatesFile, { overwrite: true });
      }
      throw error;
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates() {
    const templates = await this._readTemplates();
    // Sort: defaults first, then by creation date
    return templates.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id) {
    const templates = await this._readTemplates();
    const template = templates.find(t => t.id === id);
    
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    
    return template;
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category) {
    const templates = await this._readTemplates();
    return templates.filter(t => t.category === category);
  }

  /**
   * Get all unique categories
   */
  async getCategories() {
    const templates = await this._readTemplates();
    const categories = [...new Set(templates.map(t => t.category))];
    return categories.sort();
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData) {
    const templates = await this._readTemplates();
    
    // Validate required fields
    if (!templateData.name) {
      throw new Error('Template name is required');
    }
    
    if (!templateData.customPrompt) {
      throw new Error('Template prompt is required');
    }
    
    // Check for duplicate name (case-insensitive)
    const existingNames = templates.map(t => t.name.toLowerCase());
    if (existingNames.includes(templateData.name.toLowerCase())) {
      throw new Error(`Template with name "${templateData.name}" already exists`);
    }
    
    const now = new Date().toISOString();
    const template = {
      id: templateData.id || uuidv4(),
      name: templateData.name,
      category: templateData.category || 'Custom',
      customPrompt: templateData.customPrompt,
      tone: templateData.tone || 'neutral',
      length: templateData.length || 'medium',
      tags: templateData.tags || [],
      isDefault: false, // User templates are never default
      createdAt: now,
      updatedAt: now,
    };
    
    templates.push(template);
    await this._writeTemplates(templates);
    
    console.log(`✅ Template created: ${template.name} (${template.id})`);
    return template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id, updates) {
    const templates = await this._readTemplates();
    const index = templates.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw new Error(`Template not found: ${id}`);
    }
    
    const template = templates[index];
    
    // Don't allow updating default templates
    if (template.isDefault) {
      throw new Error('Cannot update default templates. Use "Save as New" to create a copy.');
    }
    
    // Check for duplicate name if name is being changed
    if (updates.name && updates.name !== template.name) {
      const existingNames = templates
        .filter(t => t.id !== id)
        .map(t => t.name.toLowerCase());
      
      if (existingNames.includes(updates.name.toLowerCase())) {
        throw new Error(`Template with name "${updates.name}" already exists`);
      }
    }
    
    // Update template
    templates[index] = {
      ...template,
      ...updates,
      id, // Preserve ID
      isDefault: false, // Always false for user templates
      updatedAt: new Date().toISOString(),
      createdAt: template.createdAt, // Preserve creation date
    };
    
    await this._writeTemplates(templates);
    
    console.log(`✅ Template updated: ${templates[index].name} (${id})`);
    return templates[index];
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id) {
    const templates = await this._readTemplates();
    const template = templates.find(t => t.id === id);
    
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    
    // Don't allow deleting default templates
    if (template.isDefault) {
      throw new Error('Cannot delete default templates');
    }
    
    const filtered = templates.filter(t => t.id !== id);
    await this._writeTemplates(filtered);
    
    console.log(`✅ Template deleted: ${template.name} (${id})`);
    return template;
  }

  /**
   * Duplicate a template (useful for customizing default templates)
   */
  async duplicateTemplate(id, newName) {
    const template = await this.getTemplateById(id);
    
    const duplicated = {
      ...template,
      id: uuidv4(),
      name: newName || `${template.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const templates = await this._readTemplates();
    templates.push(duplicated);
    await this._writeTemplates(templates);
    
    console.log(`✅ Template duplicated: ${duplicated.name} (${duplicated.id})`);
    return duplicated;
  }

  /**
   * Search templates by name or tags
   */
  async searchTemplates(query) {
    const templates = await this._readTemplates();
    const lowerQuery = query.toLowerCase();
    
    return templates.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(lowerQuery);
      const tagMatch = t.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      const categoryMatch = t.category.toLowerCase().includes(lowerQuery);
      
      return nameMatch || tagMatch || categoryMatch;
    });
  }

  /**
   * Replace variables in template prompt
   */
  replaceVariables(prompt, variables = {}) {
    let result = prompt;
    
    // Replace {VARIABLE_NAME} with actual values
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key.toUpperCase()}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }

  /**
   * Export template as JSON
   */
  async exportTemplate(id) {
    const template = await this.getTemplateById(id);
    
    // Remove internal fields for export
    const exportData = {
      name: template.name,
      category: template.category,
      customPrompt: template.customPrompt,
      tone: template.tone,
      length: template.length,
      tags: template.tags,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    
    return exportData;
  }

  /**
   * Import template from JSON
   */
  async importTemplate(importData) {
    // Validate import data
    if (!importData.name || !importData.customPrompt) {
      throw new Error('Invalid template data: name and customPrompt are required');
    }
    
    // Create template from import data
    return await this.createTemplate({
      name: importData.name,
      category: importData.category,
      customPrompt: importData.customPrompt,
      tone: importData.tone,
      length: importData.length,
      tags: importData.tags || [],
    });
  }
}

module.exports = PromptTemplateService;

