const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const config = require('../config/config');

class GoogleFontsService {
  constructor() {
    this.fontsDir = path.join(config.PUBLIC_DIR, 'fonts');
    this.googleFontsApiKey = process.env.GOOGLE_FONTS_API_KEY || null;
    this.fontCache = new Map();
    
    // Popular Google Fonts that work well with subtitles
    this.popularFonts = [
      'Open Sans',
      'Roboto',
      'Lato',
      'Montserrat',
      'Source Sans Pro',
      'Oswald',
      'Raleway',
      'PT Sans',
      'Ubuntu',
      'Nunito',
      'Playfair Display',
      'Merriweather',
      'Poppins',
      'Dancing Script',
      'Pacifico'
    ];
  }

  /**
   * Initialize fonts directory and download popular fonts
   */
  async initializeFonts() {
    try {
      await fs.ensureDir(this.fontsDir);
      console.log('📁 Fonts directory initialized');
      
      // Check if we have basic fonts already
      const existingFonts = await this.getInstalledFonts();
      if (existingFonts.length === 0) {
        console.log('🔄 Downloading popular Google Fonts...');
        await this.downloadPopularFonts();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize fonts:', error.message);
      return false;
    }
  }

  /**
   * Download popular Google Fonts for subtitle use
   */
  async downloadPopularFonts() {
    const downloadPromises = this.popularFonts.slice(0, 5).map(async (fontName) => {
      try {
        await this.downloadGoogleFont(fontName);
        console.log(`✅ Downloaded: ${fontName}`);
      } catch (error) {
        console.log(`⚠️ Failed to download ${fontName}: ${error.message}`);
      }
    });

    await Promise.allSettled(downloadPromises);
  }

  /**
   * Download a specific Google Font
   * @param {string} fontName - Name of the Google Font
   * @param {string} variant - Font variant (e.g., 'regular', 'bold', '700')
   * @returns {string} - Path to the downloaded font file
   */
  async downloadGoogleFont(fontName, variant = 'regular') {
    try {
      const fontKey = `${fontName}-${variant}`;
      
      // Check if font is already cached
      if (this.fontCache.has(fontKey)) {
        return this.fontCache.get(fontKey);
      }

      // Check if font file already exists
      const fontFileName = `${fontName.replace(/\s+/g, '-').toLowerCase()}-${variant}.ttf`;
      const fontPath = path.join(this.fontsDir, fontFileName);
      
      if (await fs.pathExists(fontPath)) {
        this.fontCache.set(fontKey, fontPath);
        return fontPath;
      }

      // Download font from Google Fonts
      const fontUrl = await this.getGoogleFontUrl(fontName, variant);
      if (!fontUrl) {
        throw new Error(`Could not get download URL for ${fontName}`);
      }

      await this.downloadFile(fontUrl, fontPath);
      this.fontCache.set(fontKey, fontPath);
      
      console.log(`📥 Downloaded Google Font: ${fontName} (${variant})`);
      return fontPath;
    } catch (error) {
      console.error(`❌ Failed to download Google Font ${fontName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get Google Font download URL
   * @param {string} fontName - Name of the font
   * @param {string} variant - Font variant
   * @returns {string} - Download URL for the font
   */
  async getGoogleFontUrl(fontName, variant = 'regular') {
    try {
      // Create Google Fonts CSS URL with multiple weights for better compatibility
      const encodedFontName = encodeURIComponent(fontName);
      const weight = variant === 'regular' ? '400' : variant;
      
      // Try multiple CSS URL formats for better compatibility
      const cssUrls = [
        `https://fonts.googleapis.com/css2?family=${encodedFontName}:wght@${weight}&display=swap`,
        `https://fonts.googleapis.com/css2?family=${encodedFontName}&display=swap`,
        `https://fonts.googleapis.com/css?family=${encodedFontName}:${weight}&display=swap`
      ];
      
      let fontUrl = null;
      
      // Try each URL format until we get a valid font URL
      for (const cssUrl of cssUrls) {
        try {
          console.log(`🔍 Trying Google Fonts CSS URL: ${cssUrl}`);
          const cssContent = await this.fetchUrl(cssUrl);
          
          // Extract font URL from CSS (look for .ttf or .woff2 URLs)
          const fontUrlMatches = cssContent.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:ttf|woff2))\)/g);
          
          if (fontUrlMatches && fontUrlMatches.length > 0) {
            // Prefer .ttf over .woff2 for better FFmpeg compatibility
            const ttfMatch = fontUrlMatches.find(match => match.includes('.ttf'));
            if (ttfMatch) {
              fontUrl = ttfMatch.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)[1];
            } else {
              fontUrl = fontUrlMatches[0].match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:ttf|woff2))\)/)[1];
            }
            break;
          }
        } catch (urlError) {
          console.log(`⚠️ CSS URL failed: ${cssUrl} - ${urlError.message}`);
          continue;
        }
      }
      
      if (fontUrl) {
        console.log(`✅ Found Google Font URL: ${fontUrl}`);
        return fontUrl;
      }
      
      throw new Error('Could not extract font URL from any CSS format');
    } catch (error) {
      console.error(`Failed to get Google Font URL for ${fontName}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch URL content
   * @param {string} url - URL to fetch
   * @returns {string} - Content of the URL
   */
  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Download file from URL
   * @param {string} url - URL to download
   * @param {string} outputPath - Path to save the file
   */
  downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        res.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      req.on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(new Error('Download timeout'));
      });

      req.end();
    });
  }

  /**
   * Get list of installed fonts
   * @returns {Array} - List of installed font names
   */
  async getInstalledFonts() {
    try {
      await fs.ensureDir(this.fontsDir);
      const files = await fs.readdir(this.fontsDir);
      const fontFiles = files.filter(file => file.endsWith('.ttf') || file.endsWith('.otf'));
      
      return fontFiles.map(file => {
        // Convert filename back to font name
        const baseName = path.basename(file, path.extname(file));
        return baseName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      });
    } catch (error) {
      console.error('Failed to get installed fonts:', error.message);
      return [];
    }
  }

  /**
   * Validate and prepare font for use in subtitles
   * @param {string} fontName - Name of the font
   * @param {string} variant - Font variant (optional)
   * @returns {Object} - Font configuration object
   */
  async prepareFontForSubtitles(fontName, variant = 'regular') {
    try {
      // If no font specified, use default
      if (!fontName || fontName.toLowerCase() === 'default') {
        return { fontFamily: 'Arial', fontPath: null };
      }

      // Normalize font name (remove extra spaces, handle common variations)
      const normalizedFontName = fontName.trim().replace(/\s+/g, ' ');
      
      // Check if it's a system font
      const systemFonts = [
        'Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma',
        'Courier New', 'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Arial Black',
        'Palatino', 'Garamond', 'Bookman', 'Avant Garde', 'Helvetica Neue'
      ];
      
      if (systemFonts.includes(normalizedFontName)) {
        console.log(`✅ Using system font: ${normalizedFontName}`);
        return { fontFamily: normalizedFontName, fontPath: null };
      }

      // Check if font is already cached/downloaded
      const fontKey = `${normalizedFontName}-${variant}`;
      if (this.fontCache.has(fontKey)) {
        const cachedPath = this.fontCache.get(fontKey);
        console.log(`✅ Using cached Google Font: ${normalizedFontName}`);
        return { fontFamily: normalizedFontName, fontPath: cachedPath };
      }

      // Try to download/get Google Font
      try {
        console.log(`🔄 Attempting to download Google Font: ${normalizedFontName} (${variant})`);
        const fontPath = await this.downloadGoogleFont(normalizedFontName, variant);
        
        if (fontPath && await fs.pathExists(fontPath)) {
          console.log(`✅ Successfully prepared Google Font: ${normalizedFontName}`);
          return { fontFamily: normalizedFontName, fontPath };
        } else {
          throw new Error('Font file was not created or is not accessible');
        }
      } catch (error) {
        console.log(`⚠️ Could not get Google Font ${normalizedFontName}: ${error.message}`);
        
        // Try with different variants as fallback
        const fallbackVariants = ['400', 'normal', 'regular'];
        for (const fallbackVariant of fallbackVariants) {
          if (fallbackVariant !== variant) {
            try {
              console.log(`🔄 Trying fallback variant: ${fallbackVariant}`);
              const fallbackPath = await this.downloadGoogleFont(normalizedFontName, fallbackVariant);
              if (fallbackPath && await fs.pathExists(fallbackPath)) {
                console.log(`✅ Successfully prepared Google Font with fallback variant: ${normalizedFontName} (${fallbackVariant})`);
                return { fontFamily: normalizedFontName, fontPath: fallbackPath };
              }
            } catch (fallbackError) {
              console.log(`⚠️ Fallback variant ${fallbackVariant} also failed: ${fallbackError.message}`);
            }
          }
        }
        
        console.log(`❌ All attempts failed for ${normalizedFontName}, falling back to Arial`);
        return { fontFamily: 'Arial', fontPath: null };
      }
    } catch (error) {
      console.error('Error preparing font:', error.message);
      return { fontFamily: 'Arial', fontPath: null };
    }
  }

  /**
   * Get popular fonts list
   * @returns {Array} - List of popular Google Fonts
   */
  getPopularFonts() {
    return [...this.popularFonts];
  }

  /**
   * Check if a Google Font exists and is available
   * @param {string} fontName - Name of the font to check
   * @returns {Promise<boolean>} - True if font exists
   */
  async isGoogleFontAvailable(fontName) {
    try {
      const fontUrl = await this.getGoogleFontUrl(fontName);
      return fontUrl !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available font variants for a Google Font
   * @param {string} fontName - Name of the font
   * @returns {Promise<Array>} - Array of available variants
   */
  async getFontVariants(fontName) {
    try {
      const encodedFontName = encodeURIComponent(fontName);
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFontName}&display=swap`;
      const cssContent = await this.fetchUrl(cssUrl);
      
      // Extract font weights from CSS
      const weightMatches = cssContent.match(/font-weight:\s*(\d+)/g);
      const variants = new Set();
      
      if (weightMatches) {
        weightMatches.forEach(match => {
          const weight = match.match(/font-weight:\s*(\d+)/)[1];
          variants.add(weight);
        });
      }
      
      // Add common variants if none found
      if (variants.size === 0) {
        variants.add('400'); // Regular
        variants.add('700'); // Bold
      }
      
      return Array.from(variants);
    } catch (error) {
      console.error(`Failed to get variants for ${fontName}:`, error.message);
      return ['400']; // Default to regular
    }
  }

  /**
   * Search for Google Fonts by name (partial matching)
   * @param {string} searchTerm - Search term for font name
   * @returns {Promise<Array>} - Array of matching font names
   */
  async searchGoogleFonts(searchTerm) {
    try {
      // This is a simplified search - in a real implementation, you might use Google Fonts API
      // For now, we'll check against popular fonts and some common patterns
      const searchLower = searchTerm.toLowerCase();
      const matchingFonts = this.popularFonts.filter(font => 
        font.toLowerCase().includes(searchLower)
      );
      
      // Add some common Google Fonts that might match
      const commonGoogleFonts = [
        'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Source Sans Pro',
        'Oswald', 'Raleway', 'PT Sans', 'Ubuntu', 'Nunito', 'Playfair Display',
        'Merriweather', 'Poppins', 'Dancing Script', 'Pacifico', 'Lobster',
        'Bebas Neue', 'Anton', 'Fjalla One', 'Righteous', 'Orbitron',
        'Exo', 'Quicksand', 'Work Sans', 'Inter', 'Fira Sans', 'Crimson Text',
        'Libre Baskerville', 'PT Serif', 'Source Serif Pro', 'Crimson Pro'
      ];
      
      const additionalMatches = commonGoogleFonts.filter(font => 
        font.toLowerCase().includes(searchLower) && !matchingFonts.includes(font)
      );
      
      return [...matchingFonts, ...additionalMatches];
    } catch (error) {
      console.error('Error searching Google Fonts:', error.message);
      return [];
    }
  }
}

module.exports = GoogleFontsService;
