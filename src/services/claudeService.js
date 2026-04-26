const Anthropic = require('@anthropic-ai/sdk');
const apiConfig = require('../config/api.config');
const PromptTemplateService = require('./promptTemplateService');

class ClaudeService {
  constructor() {
    if (!apiConfig.claude.apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not configured. Claude service will not work.');
    }
    
    this.client = new Anthropic({
      apiKey: apiConfig.claude.apiKey,
    });
    
    this.config = {
      ...apiConfig.claude,
      maxRetries: 3,
    };
    
    this.promptTemplateService = new PromptTemplateService();
  }

  /**
   * Generate a video script with enhanced options
   * @param {object} options - Script generation options
   * @param {string} options.title - Main topic/title (required)
   * @param {string} options.context - Additional context for better scripts
   * @param {array} options.referenceScripts - Example scripts to learn patterns from
   * @param {string} options.customPrompt - Additional instructions
   * @param {string} options.promptTemplateId - ID of prompt template to use
   * @param {object} options.templateVariables - Variables to replace in template
   * @param {string} options.tone - Script tone (dramatic, educational, mysterious, etc.)
   * @param {string} options.length - Script length (short, medium, long)
   * @param {number} options.targetWordCount - Target word count for script (overrides length)
   * @param {number} options.targetDuration - Target duration in seconds (will calculate word count)
   * @returns {Promise<object>} Generated script with sentences and metadata
   */
  async generateScript(options = {}) {
    const {
      title,
      context = '',
      referenceScripts = [],
      customPrompt = '',
      promptTemplateId = null,
      templateVariables = {},
      tone = 'informative',
      length = 'medium',
      targetWordCount = null,
      targetDuration = null,
      maxTokens = this.config.maxTokens,
      language = 'English', // Language for script generation (matches voice language)
    } = options;

    if (!title) {
      throw new Error('Title is required for script generation');
    }

    let attempt = 0;
    const maxRetries = this.config.maxRetries;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🤖 Generating script with Claude (attempt ${attempt}/${maxRetries})...`);
        console.log(`   Title: "${title}"`);
        
        // Calculate target word count from duration if provided
        let calculatedWordCount = targetWordCount;
        if (targetDuration && !targetWordCount) {
          // Average speaking rate: 2.5 words per second
          calculatedWordCount = Math.round(targetDuration * 2.5);
          console.log(`   Target Duration: ${targetDuration}s → ${calculatedWordCount} words`);
        } else if (targetWordCount) {
          console.log(`   Target Word Count: ${targetWordCount} words`);
        }
        
        console.log(`   Tone: ${tone}, Length: ${length}`);
        
        // Load prompt template if specified
        let templatePrompt = '';
        let templateInfo = null;
        if (promptTemplateId) {
          try {
            const template = await this.promptTemplateService.getTemplateById(promptTemplateId);
            templatePrompt = this.promptTemplateService.replaceVariables(
              template.customPrompt,
              { ...templateVariables, TOPIC: title, TONE: tone, LENGTH: length }
            );
            templateInfo = {
              id: template.id,
              name: template.name,
              category: template.category,
            };
            console.log(`   Using template: "${template.name}" (${template.category})`);
          } catch (error) {
            console.warn(`⚠️  Could not load template ${promptTemplateId}:`, error.message);
          }
        }

        const systemPrompt = this._buildEnhancedSystemPrompt(
          referenceScripts,
          tone,
          length,
          templatePrompt,
          calculatedWordCount,
          language
        );
        const userPrompt = this._buildUserPrompt(title, context, customPrompt, calculatedWordCount, language);
        
        const startTime = Date.now();
        const message = await this.client.messages.create({
          model: this.config.model,
          max_tokens: maxTokens,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        const scriptContent = message.content[0].text;
        const processingTime = Date.now() - startTime;
        
        // Parse script into sentences with markers
        const sentences = this._parseScriptIntoSentences(scriptContent);
        const estimatedDuration = this._estimateDuration(scriptContent);
        const actualWordCount = scriptContent.split(/\s+/).length;

        // Log API usage
        console.log(`✅ Script generated successfully in ${processingTime}ms`);
        console.log(`   Model: ${this.config.model}`);
        console.log(`   Tokens: ${message.usage.input_tokens} in + ${message.usage.output_tokens} out`);
        console.log(`   Sentences: ${sentences.length}`);
        console.log(`   Word count: ${actualWordCount}${targetWordCount ? ` (target: ${targetWordCount})` : ''}`);
        console.log(`   Est. duration: ${estimatedDuration}s`);
        
        return {
          success: true,
          script: scriptContent,
          sentences,
          estimatedDuration,
          wordCount: actualWordCount,
          metadata: {
            model: this.config.model,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            totalTokens: message.usage.input_tokens + message.usage.output_tokens,
            tone,
            length,
            targetWordCount: targetWordCount || null,
            actualWordCount,
            targetDuration: targetDuration || null,
            processingTime,
            attempt,
            promptTemplate: templateInfo,
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error(`❌ Claude script generation error (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt >= maxRetries) {
          throw new Error(`Script generation failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`   Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Build enhanced system prompt with reference script analysis and template
   * @private
   */
  _buildEnhancedSystemPrompt(referenceScripts, tone, length, templatePrompt = '', targetWordCount = null, language = 'English') {
    const lengthGuide = {
      short: '30-60 seconds (approximately 75-150 words)',
      medium: '60-120 seconds (approximately 150-300 words)',
      long: '2-5 minutes (approximately 300-750 words)',
    };

    // Use specific word count if provided, otherwise use length guide
    const lengthSpec = targetWordCount 
      ? `approximately ${targetWordCount} words (${Math.round(targetWordCount / 2.5)} seconds at average speaking rate)`
      : lengthGuide[length];

    let prompt = `You are an expert video script writer specializing in engaging, viral-worthy content for short-form videos.

TARGET SPECIFICATIONS:
- Tone: ${tone}
- Target Length: ${lengthSpec}
- Format: Natural speaking style optimized for voiceover
- Language: ${language}
${targetWordCount ? `\n🎯 CRITICAL: Generate EXACTLY ${targetWordCount} words (±10 words). This is essential for video timing.\n` : ''}

🌍 LANGUAGE REQUIREMENT:
The script MUST be written entirely in ${language}. The voiceover will be recorded in ${language}, so every word, phrase, and sentence must be in this language. Do not translate or use any other language.
`;


    // Add template prompt if provided (highest priority)
    if (templatePrompt) {
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOM TEMPLATE INSTRUCTIONS:
The following custom instructions define the specific style, structure, and approach for this script.
Follow these guidelines closely as they represent the desired output format and quality.

${templatePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    }

    // Add reference script analysis if provided
    if (referenceScripts && referenceScripts.length > 0) {
      prompt += `REFERENCE SCRIPTS FOR STYLE LEARNING:
You have been provided with ${referenceScripts.length} reference script(s) that demonstrate the desired writing style.
Study these carefully before generating the new script.

${referenceScripts.map((script, i) => `\n━━━━━ REFERENCE SCRIPT ${i + 1} ━━━━━\n${script}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`).join('\n')}

CRITICAL ANALYSIS REQUIRED:
Before generating the new script, analyze the reference examples for:

1. WRITING STYLE:
   - Tone and voice (conversational, dramatic, educational, mysterious, etc.)
   - Sentence length patterns (short/punchy vs. longer/flowing)
   - Vocabulary level and word choices
   - Use of questions, exclamations, or statements

2. STRUCTURAL PATTERNS:
   - How do the scripts open? (questions, facts, statements)
   - What hook techniques are used to grab attention?
   - How do ideas transition between paragraphs?
   - How do they conclude or leave impact?

3. ENGAGEMENT TECHNIQUES:
   - Use of "you" to address the audience
   - Rhetorical questions or direct questions
   - Present vs past tense usage
   - Building tension or curiosity
   - Pacing through sentence rhythm

4. VISUAL STORYTELLING:
   - Scene-setting language
   - Descriptive vs action-focused writing
   - How scenes connect logically

REQUIREMENT: Match the style, tone, and structural patterns from these references while creating original content about the new topic.

`;
    }

    prompt += `SCRIPT WRITING GUIDELINES:
1. HOOK (First 3-5 seconds): Create an immediate attention-grabbing opening
   - Start with a question, surprising fact, or bold statement
   - Make viewers curious about what's next

2. STRUCTURE:
   - Each sentence should be clear and complete
   - Use short, punchy sentences for impact
   - Include natural pauses for emphasis
   - Mark scene transitions clearly

3. ENGAGEMENT:
   - Write conversationally (like talking to a friend)
   - Use active voice and present tense when possible
   - Include rhetorical questions to maintain interest
   - Build curiosity throughout

4. PACING:
   - Vary sentence length for rhythm
   - Use shorter sentences for key points
   - Add moments for visual emphasis

5. VISUAL ALIGNMENT:
   - Each major point should align with a visual scene
   - Mark natural transition points with "---" or paragraph breaks
   - Write with the understanding that images will support each section

OUTPUT FORMAT:
Write the complete script as natural, flowing text. Each paragraph represents a scene or major thought. Use clear sentence breaks.

Return ONLY the script text - no titles, no labels, no meta-commentary.`;

    return prompt;
  }

  /**
   * Build user prompt with title, context, and custom instructions
   * @private
   */
  _buildUserPrompt(title, context, customPrompt, targetWordCount = null, language = 'English') {
    let prompt = `Create a video script about: "${title}"`;

    if (language !== 'English') {
      prompt += `\n\n🌍 CRITICAL: Write the ENTIRE script in ${language}. Every single word, sentence, and phrase must be in ${language}.`;
    }

    if (context) {
      prompt += `\n\nAdditional Context:\n${context}`;
    }

    if (customPrompt) {
      prompt += `\n\nSpecial Instructions:\n${customPrompt}`;
    }

    if (targetWordCount) {
      prompt += `\n\n🎯 IMPORTANT: Generate approximately ${targetWordCount} words to match the target video duration. Count your words carefully.`;
    }

    prompt += `\n\nGenerate an engaging, natural-sounding script that flows well when spoken aloud.`;

    return prompt;
  }

  /**
   * Parse script into sentences with markers
   * @private
   */
  _parseScriptIntoSentences(script) {
    // Split by sentence endings (., !, ?) while preserving them
    const sentencePattern = /[^.!?]+[.!?]+/g;
    const matches = script.match(sentencePattern) || [];
    
    return matches.map((sentence, index) => ({
      text: sentence.trim(),
      index,
      words: sentence.trim().split(/\s+/).length,
    })).filter(s => s.text.length > 0);
  }

  /**
   * Estimate duration based on word count and average speaking rate
   * @private
   */
  _estimateDuration(script) {
    const words = script.split(/\s+/).length;
    const wordsPerSecond = 2.5; // Average speaking rate
    return Math.ceil(words / wordsPerSecond);
  }

  /**
   * Generate a structured N-scene script as JSON. Used by the cartoon
   * generator pipeline to produce {imagePrompt, voiceoverText, durationSeconds}
   * per scene.
   *
   * @param {string} input - Topic string OR full example script to rewrite
   * @param {object} options
   * @param {number} options.sceneCount - Number of scenes to produce
   * @param {string} [options.styleId] - Style hint (informs prompt tone only;
   *     Flux suffix is applied downstream)
   * @param {number} [options.totalDurationSeconds] - Soft target; scenes are
   *     divided roughly evenly
   * @param {string} [options.language='English']
   * @param {string} [options.tone='dramatic']
   * @param {string} [options.mode='topic'] - 'topic' or 'rewrite' (source_script)
   * @returns {Promise<{scenes: Array<{sceneIndex:number, imagePrompt:string, voiceoverText:string, durationSeconds:number}>}>}
   */
  async generateSceneScript(input, options = {}) {
    const {
      sceneCount,
      styleId = null,
      totalDurationSeconds = null,
      language = 'English',
      tone = 'dramatic',
      mode = 'topic',
    } = options;

    if (!input || typeof input !== 'string') {
      throw new Error('input (topic or source script) is required');
    }
    if (!sceneCount || sceneCount < 1) {
      throw new Error('sceneCount must be >= 1');
    }

    if (!this.config.apiKey) {
      throw new Error(
        'Claude is not configured: set ANTHROPIC_API_KEY in your server .env ' +
        '(get a key at https://console.anthropic.com/settings/keys), then restart the backend.'
      );
    }

    const perSceneSeconds = totalDurationSeconds
      ? Math.max(2, Math.round(totalDurationSeconds / sceneCount))
      : 5;

    const systemPrompt = `You are an expert short-form video scriptwriter AND visual director for AI-generated cartoons. You produce scene-by-scene breakdowns that pair a detailed cartoon image prompt with a short voiceover line.

HARD RULES:
1. Output VALID JSON ONLY. No prose, no markdown, no code fences.
2. Exactly ${sceneCount} scenes, in order, sceneIndex starting at 0.
3. Each scene must have: sceneIndex (int), imagePrompt (string), voiceoverText (string), durationSeconds (number).
4. voiceoverText must be in ${language}. Around ${Math.round(perSceneSeconds * 2.4)} words per scene (so it fits ~${perSceneSeconds}s at normal speaking pace).
5. imagePrompt should be in English regardless of voiceover language -- Flux responds best to English. Describe the scene concretely: subject, action, setting, mood, camera framing. 20-60 words. Do NOT include any style descriptors ("cartoon", "3D", "anime") -- those are applied downstream via a style preset.
6. durationSeconds should be a reasonable integer in the 3-8 range that matches voiceover length. Sum roughly equals ${totalDurationSeconds || sceneCount * perSceneSeconds}.
7. Tone: ${tone}. The opening scene should hook the viewer immediately.

OUTPUT SHAPE (exact keys, no extras):
{
  "scenes": [
    { "sceneIndex": 0, "imagePrompt": "...", "voiceoverText": "...", "durationSeconds": 5 }
  ]
}`;

    const userPrompt = mode === 'rewrite'
      ? `Rewrite the following script into ${sceneCount} scenes. Keep the story and key beats; split it into scenes that flow visually.\n\nSOURCE SCRIPT:\n${input}`
      : `Topic: "${input}"\n\nCreate a ${sceneCount}-scene cartoon breakdown.${styleId ? ` Style hint: ${styleId}.` : ''}`;

    const maxAttempts = 2;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🎬 Generating ${sceneCount}-scene script (attempt ${attempt}/${maxAttempts})...`);
        const message = await this.client.messages.create({
          model: this.config.model,
          max_tokens: Math.max(this.config.maxTokens, 2048),
          temperature: attempt === 1 ? 0.7 : 0.4, // tighten on retry
          system: attempt === 1
            ? systemPrompt
            : systemPrompt + '\n\nPREVIOUS ATTEMPT PRODUCED INVALID JSON. Respond with pure JSON only.',
          messages: [{ role: 'user', content: userPrompt }],
        });

        let text = message.content[0].text.trim();
        // Strip accidental code fences.
        if (text.startsWith('```')) {
          text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        }

        const parsed = JSON.parse(text);
        if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
          throw new Error('Response missing "scenes" array');
        }
        if (parsed.scenes.length !== sceneCount) {
          throw new Error(`Expected ${sceneCount} scenes, got ${parsed.scenes.length}`);
        }

        const scenes = parsed.scenes.map((s, i) => ({
          sceneIndex: Number.isInteger(s.sceneIndex) ? s.sceneIndex : i,
          imagePrompt: String(s.imagePrompt || '').trim(),
          voiceoverText: String(s.voiceoverText || '').trim(),
          durationSeconds: Number(s.durationSeconds) || perSceneSeconds,
        }));

        for (const s of scenes) {
          if (!s.imagePrompt || !s.voiceoverText) {
            throw new Error(`Scene ${s.sceneIndex} is missing imagePrompt or voiceoverText`);
          }
        }

        console.log(`✅ Scene script parsed (${scenes.length} scenes)`);
        return {
          scenes,
          metadata: {
            model: this.config.model,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            attempt,
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(`⚠️  Scene script parse failed (attempt ${attempt}): ${err.message}`);
      }
    }

    throw new Error(`generateSceneScript failed: ${lastError?.message || 'unknown error'}`);
  }

  /**
   * Generate N alternative hook scripts for the opening of an existing
   * cartoon. Returns { hooks: [{ variantIndex, script }] }.
   */
  async generateHookVariants({ originalOpening, topic, variantCount = 3, hookDurationSeconds = 10, language = 'English' }) {
    const targetWords = Math.round(hookDurationSeconds * 2.5);
    const systemPrompt = `You rewrite the opening seconds of a cartoon video into MULTIPLE distinct hook variants designed to grab viewer attention in the first ${hookDurationSeconds} seconds.

RULES:
1. Output VALID JSON ONLY: { "hooks": [ { "variantIndex": 0, "script": "..." } ] }.
2. Exactly ${variantCount} hooks, each ~${targetWords} words (±20%) in ${language}.
3. Each hook must be DIFFERENT in angle: try (a) shocking statistic / fact, (b) rhetorical question, (c) bold claim or challenge.
4. Hooks must flow naturally into the rest of the story; do not reveal the conclusion.`;

    const userPrompt = `Topic: ${topic || '(unknown)'}\n\nORIGINAL OPENING:\n${originalOpening}\n\nProduce ${variantCount} hook rewrites.`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 1024,
          temperature: attempt === 1 ? 0.8 : 0.5,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        let text = message.content[0].text.trim();
        if (text.startsWith('```')) {
          text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        }
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.hooks) || parsed.hooks.length !== variantCount) {
          throw new Error('Invalid hooks shape');
        }
        return {
          hooks: parsed.hooks.map((h, i) => ({
            variantIndex: Number.isInteger(h.variantIndex) ? h.variantIndex : i,
            script: String(h.script || '').trim(),
          })),
        };
      } catch (err) {
        if (attempt === 2) throw new Error(`Hook generation failed: ${err.message}`);
      }
    }
  }

  /**
   * Generate image prompts from a script
   * @param {string} script - The video script
   * @param {number} numberOfImages - Number of image prompts to generate
   * @returns {Promise<object>} Image prompts with descriptions
   */
  async generateImagePrompts(script, numberOfImages = 5) {
    try {
      const systemPrompt = `You are an expert at creating detailed, visually compelling image prompts for AI image generation.
Given a video script, generate ${numberOfImages} distinct image prompts that would visually represent different parts of the video.

Return ONLY a valid JSON array in this exact format:
[
  {
    "sequence": 1,
    "prompt": "detailed image prompt here",
    "description": "brief description of what this image represents in the video"
  }
]

Make prompts detailed, specific, and optimized for AI image generation (Flux, DALL-E, etc.).`;

      console.log('🎨 Generating image prompts with Claude...');

      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 2048,
        temperature: 0.8,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Script:\n\n${script}\n\nGenerate ${numberOfImages} image prompts for this script.`,
          },
        ],
      });

      let responseText = message.content[0].text.trim();
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```')) {
        // Remove ```json or ``` at the start
        responseText = responseText.replace(/^```(?:json)?\s*\n?/i, '');
        // Remove ``` at the end
        responseText = responseText.replace(/\n?```\s*$/i, '');
        responseText = responseText.trim();
      }
      
      const imagePrompts = JSON.parse(responseText);

      return {
        success: true,
        imagePrompts,
        metadata: {
          scriptLength: script.length,
          numberOfImages,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Claude image prompt generation error:', error.message);
      console.error('   Response text:', message?.content?.[0]?.text?.substring(0, 200));
      throw new Error(`Image prompt generation failed: ${error.message}`);
    }
  }

  /**
   * Refine or edit a script
   * @param {string} script - Original script
   * @param {string} instructions - Edit instructions
   * @returns {Promise<object>} Refined script
   */
  async refineScript(script, instructions) {
    try {
      const systemPrompt = 'You are an expert video script editor. Refine the provided script based on the user\'s instructions while maintaining the core message and flow.';

      console.log('✏️  Refining script with Claude...');

      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Original Script:\n\n${script}\n\nEdit Instructions:\n${instructions}\n\nProvide the refined script:`,
          },
        ],
      });

      const refinedScript = message.content[0].text;

      return {
        success: true,
        refinedScript,
        originalLength: script.length,
        newLength: refinedScript.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Claude script refinement error:', error.message);
      throw new Error(`Script refinement failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt based on options
   * @private
   */
  _buildSystemPrompt(tone, length, style, targetAudience, includeHooks) {
    const lengthGuide = {
      short: '30-60 seconds (approximately 75-150 words)',
      medium: '60-120 seconds (approximately 150-300 words)',
      long: '2-5 minutes (approximately 300-750 words)',
    };

    return `You are an expert video script writer specializing in engaging, viral-worthy content.

REQUIREMENTS:
- Tone: ${tone}
- Style: ${style}
- Target Length: ${lengthGuide[length]}
- Target Audience: ${targetAudience}
${includeHooks ? '- Include a strong hook in the first 3-5 seconds' : ''}

SCRIPT STRUCTURE:
1. Hook (first 3-5 seconds) - Grab attention immediately
2. Introduction - Set context
3. Main Content - Deliver value
4. Call-to-Action - Clear next step

GUIDELINES:
- Write in a conversational, natural speaking style
- Use short sentences and paragraphs
- Include natural pauses (indicate with "...")
- Avoid jargon unless appropriate for audience
- Make it engaging and easy to follow
- Focus on delivering value quickly

Return ONLY the script text, no additional commentary or metadata.`;
  }
}

module.exports = ClaudeService;

