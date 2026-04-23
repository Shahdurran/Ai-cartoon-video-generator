const express = require('express');
const router = express.Router();
const VideoController = require('../controllers/videoController');
const GoogleFontsService = require('../services/googleFontsService');

router.post('/generate-video', VideoController.generateVideo);

// Get available fonts
router.get('/fonts', async (req, res) => {
  try {
    const googleFonts = new GoogleFontsService();
    const popularFonts = googleFonts.getPopularFonts();
    const installedFonts = await googleFonts.getInstalledFonts();
    
    res.json({
      popularFonts,
      installedFonts,
      systemFonts: ['Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma']
    });
  } catch (error) {
    console.error('Error getting fonts:', error);
    res.status(500).json({ error: 'Failed to get fonts list' });
  }
});

// Search Google Fonts endpoint
router.get('/fonts/search', async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search term must be at least 2 characters long' 
      });
    }
    
    const googleFonts = new GoogleFontsService();
    const matchingFonts = await googleFonts.searchGoogleFonts(searchTerm.trim());
    
    res.json({
      searchTerm: searchTerm.trim(),
      matchingFonts,
      totalFound: matchingFonts.length
    });
  } catch (error) {
    console.error('Error searching fonts:', error);
    res.status(500).json({ error: 'Failed to search fonts' });
  }
});

// Check if a specific Google Font is available
router.get('/fonts/check/:fontName', async (req, res) => {
  try {
    const { fontName } = req.params;
    
    if (!fontName || fontName.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Font name is required' 
      });
    }
    
    const googleFonts = new GoogleFontsService();
    const isAvailable = await googleFonts.isGoogleFontAvailable(fontName.trim());
    const variants = isAvailable ? await googleFonts.getFontVariants(fontName.trim()) : [];
    
    res.json({
      fontName: fontName.trim(),
      isAvailable,
      variants,
      message: isAvailable 
        ? `Font "${fontName}" is available on Google Fonts`
        : `Font "${fontName}" is not available on Google Fonts`
    });
  } catch (error) {
    console.error('Error checking font:', error);
    res.status(500).json({ error: 'Failed to check font availability' });
  }
});

module.exports = router; 