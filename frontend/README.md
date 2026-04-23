# Video Generation System - Frontend

React frontend for managing the video generation system.

## Features

- **Dashboard**: Overview of system statistics and quick start guide
- **Channel Management**: Create, edit, and delete channels with custom settings
- **Video Generation**: Generate single videos or batch process multiple videos
- **Queue Monitor**: Real-time monitoring of video generation jobs
- **Modern UI**: Clean, responsive design with Tailwind CSS

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 16+ 
- Backend server running on `http://localhost:3000`

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable components
│   │   ├── ChannelList.jsx
│   │   ├── ChannelForm.jsx
│   │   ├── VideoGenerator.jsx
│   │   ├── QueueMonitor.jsx
│   │   ├── BatchProcessor.jsx
│   │   └── VideoPreview.jsx
│   ├── pages/              # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Channels.jsx
│   │   └── Generate.jsx
│   ├── services/           # API services
│   │   └── api.js
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── index.html              # HTML template
└── package.json
```

## API Configuration

The frontend connects to the backend API at `http://localhost:3000/api`. 

To change the API URL, edit `frontend/src/services/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

## Usage

### Creating a Channel

1. Navigate to the **Channels** tab
2. Click **New Channel**
3. Fill in the channel settings:
   - Basic info (name, type)
   - Voice settings (provider, voice, speed)
   - Visual settings (style, aspect ratio, quality)
   - Subtitle settings (font, colors, size)
   - Effects (overlays, opacity)
4. Click **Save Channel**

### Generating a Video

1. Navigate to the **Generate** tab
2. Select a channel
3. Enter video title and context
4. Optionally add custom prompt
5. Click **Generate Video**
6. Monitor progress in the **Queue** tab

### Batch Processing

1. Navigate to the **Generate** tab
2. Switch to **Batch Processing**
3. Enter JSON data with multiple videos
4. Click **Submit Batch**

### Monitoring Queue

1. Navigate to the **Queue** tab
2. View all active jobs with real-time updates
3. Check progress bars and status
4. Cancel jobs if needed

## Components

### ChannelList
Displays all channels in a grid layout with actions to edit, delete, or generate videos.

### ChannelForm
Modal form for creating and editing channels with all configuration options.

### VideoGenerator
Form to generate a single video with AI-generated script and images.

### QueueMonitor
Real-time queue monitoring with auto-refresh and job status updates.

### BatchProcessor
Interface for submitting multiple video generation jobs at once.

### VideoPreview
Modal to preview and download generated videos.

## Styling

The app uses Tailwind CSS for styling. Custom styles can be added to `src/index.css`.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### CORS Errors

Make sure the backend server has CORS enabled for `http://localhost:5173`.

### API Connection Failed

1. Verify backend server is running on port 3000
2. Check the API_BASE_URL in `src/services/api.js`
3. Check browser console for error details

### Build Errors

Clear cache and reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```
