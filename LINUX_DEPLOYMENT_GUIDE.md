# Linux Deployment Guide

## Font Support Requirements

For custom Google Fonts to work on Ubuntu/Linux, you need to ensure FFmpeg has proper font support.

### Required Packages

Install these packages on your Ubuntu VPS:

```bash
# Update package list
sudo apt update

# Install FFmpeg with font support
sudo apt install ffmpeg

# Install fontconfig for font management
sudo apt install fontconfig

# Install additional font libraries
sudo apt install fonts-liberation fonts-dejavu-core

# Optional: Install common fonts
sudo apt install fonts-noto fonts-roboto
```

### Verify FFmpeg Font Support

Check if FFmpeg was compiled with libass (subtitle support):

```bash
ffmpeg -version | grep libass
```

You should see something like:
```
--enable-libass
```

### Test Font Installation

You can test if fonts are being installed correctly:

```bash
# List all available fonts
fc-list

# Search for a specific font
fc-list | grep -i "courier"

# Update font cache manually if needed
fc-cache -f -v
```

### Font Directory Structure

On Linux, fonts are installed to:
- User fonts: `~/.local/share/fonts/`
- System fonts: `/usr/share/fonts/`

The application uses the user fonts directory to avoid requiring sudo privileges.

### Troubleshooting

If fonts aren't working:

1. **Check FFmpeg build**: Ensure FFmpeg includes libass
2. **Verify fontconfig**: Run `fc-cache -f -v` manually
3. **Check permissions**: Ensure the application can write to `~/.local/share/fonts/`
4. **Test manually**: Try copying a font file to `~/.local/share/fonts/` and run `fc-cache -f`

### Docker Considerations

If deploying with Docker, add these to your Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
```

## How It Works

1. **Font Download**: Google Fonts are downloaded to `public/fonts/`
2. **Temporary Installation**: Fonts are copied to `~/.local/share/fonts/`
3. **Font Cache Update**: `fc-cache -f -v` is run to update the font cache
4. **FFmpeg Usage**: FFmpeg uses the font by name (e.g., "Courier Prime")
5. **Cleanup**: Fonts are removed after video generation

This approach works on both Windows and Linux without requiring administrator privileges.
