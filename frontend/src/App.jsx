import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Home, Layers, Video, Clock, Activity, Film } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Generate from './pages/Generate';
import QueueMonitor from './components/QueueMonitor';
import SystemStatus from './pages/SystemStatus';
import VideoLibrary from './components/VideoLibrary';
import './index.css';

function App() {
  const [selectedChannel, setSelectedChannel] = useState(null);

  const handleGenerateFromChannel = (channel) => {
    setSelectedChannel(channel);
    // Navigation will be handled by NavLink click
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Video Generation System
                </h1>
                <p className="text-sm text-gray-500">
                  AI-Powered Video Creation Platform
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Home size={18} />
                Dashboard
              </NavLink>
              <NavLink
                to="/channels"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Layers size={18} />
                Channels
              </NavLink>
              <NavLink
                to="/generate"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Video size={18} />
                Generate
              </NavLink>
              <NavLink
                to="/library"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Film size={18} />
                Library
              </NavLink>
              <NavLink
                to="/queue"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Clock size={18} />
                Queue
              </NavLink>
              <NavLink
                to="/system"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Activity size={18} />
                System
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/channels"
              element={<Channels onGenerate={handleGenerateFromChannel} />}
            />
            <Route
              path="/generate"
              element={<Generate selectedChannel={selectedChannel} />}
            />
            <Route path="/library" element={<VideoLibrary />} />
            <Route path="/queue" element={<QueueMonitor />} />
            <Route path="/system" element={<SystemStatus />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-500">
              Video Generation System - Powered by AI
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
