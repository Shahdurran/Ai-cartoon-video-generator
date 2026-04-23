/**
 * Seed data for the style library.
 *
 * Each style contributes:
 *   - flux_prompt_suffix:   appended to every Flux image prompt
 *   - negative_prompt:      passed through to Flux as the negative prompt
 *   - ffmpeg_color_grade:   filter string merged into the final assembly eq filter
 *   - thumbnail_key:        R2 key for the preview image (uploaded separately)
 *
 * Edits here are picked up on the next deploy because styleRepo.seed() is
 * idempotent and performs an UPSERT.
 */

module.exports = [
  {
    id: 'pixar-3d',
    name: 'Pixar-style 3D',
    thumbnail_key: 'styles/pixar-3d.png',
    flux_prompt_suffix:
      ', pixar-style 3D animation, soft warm lighting, cinematic depth of field, expressive characters',
    negative_prompt: 'realistic, photographic, blurry, low quality, distorted',
    ffmpeg_color_grade: 'eq=saturation=1.2:contrast=1.05:brightness=0.02',
  },
  {
    id: 'classic-2d',
    name: 'Classic 2D Cartoon',
    thumbnail_key: 'styles/classic-2d.png',
    flux_prompt_suffix:
      ', classic hand-drawn 2D cartoon, bold black outlines, flat cel-shaded colors, 1990s Saturday morning cartoon style',
    negative_prompt: 'realistic, 3D render, photograph, grainy, gritty',
    ffmpeg_color_grade: 'eq=saturation=1.3:contrast=1.1',
  },
  {
    id: 'anime',
    name: 'Anime',
    thumbnail_key: 'styles/anime.png',
    flux_prompt_suffix:
      ', anime illustration, clean line art, vibrant cel shading, dramatic lighting, studio-quality Japanese animation style',
    negative_prompt:
      'realistic, photographic, western cartoon, low quality, deformed, extra limbs',
    ffmpeg_color_grade: 'eq=saturation=1.25:contrast=1.08',
  },
  {
    id: 'flat-illustration',
    name: 'Flat Illustration',
    thumbnail_key: 'styles/flat-illustration.png',
    flux_prompt_suffix:
      ', modern flat vector illustration, geometric shapes, minimal detail, bold pastel color palette, clean composition',
    negative_prompt: 'realistic, photographic, gradient-heavy, 3D render, textured',
    ffmpeg_color_grade: 'eq=saturation=1.15:contrast=1.03',
  },
];
