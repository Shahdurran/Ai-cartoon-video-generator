import { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle, AlertTriangle, XCircle, Activity, ExternalLink } from 'lucide-react';
import { systemAPI } from '../services/api';
import ServiceStatusCard from '../components/ServiceStatusCard';
import ResourceUsageCard from '../components/ResourceUsageCard';

const SystemStatus = () => {
  const [health, setHealth] = useState(null);
  const [resources, setResources] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState({});

  useEffect(() => {
    loadSystemHealth();
    loadSystemInfo();
    
    // Auto-refresh every 30 seconds
    const healthInterval = setInterval(() => {
      loadSystemHealth(true);
    }, 30000);
    
    // Update resources every 5 seconds
    const resourceInterval = setInterval(() => {
      loadResources();
    }, 5000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(resourceInterval);
    };
  }, []);

  const loadSystemHealth = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await systemAPI.getHealth();
      setHealth(response.health);
      setResources(response.health.resources);
    } catch (err) {
      console.error('Error loading system health:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const response = await systemAPI.getResources();
      setResources(response.resources);
    } catch (err) {
      console.error('Error loading resources:', err);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await systemAPI.getSystemInfo();
      setSystemInfo(response);
    } catch (err) {
      console.error('Error loading system info:', err);
    }
  };

  const testService = async (service) => {
    try {
      setTesting(prev => ({ ...prev, [service]: true }));
      const response = await systemAPI.testService(service);
      
      // Update the specific service in health
      setHealth(prev => ({
        ...prev,
        services: {
          ...prev.services,
          [service]: response.result
        }
      }));
    } catch (err) {
      console.error('Error testing service:', err);
    } finally {
      setTesting(prev => ({ ...prev, [service]: false }));
    }
  };

  const testAllServices = async () => {
    const services = ['redis', 'claude', 'fal', 'genaipro', 'assemblyai', 'ffmpeg'];
    for (const service of services) {
      await testService(service);
    }
  };

  const exportReport = async () => {
    try {
      const blob = await systemAPI.exportReport();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-status-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  const getOverallStatusBadge = () => {
    if (!health) return null;
    
    const status = health.overallStatus;
    const badges = {
      operational: {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        text: 'All Systems Operational'
      },
      degraded: {
        icon: AlertTriangle,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        text: 'Degraded Performance'
      },
      disruption: {
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-200',
        text: 'Service Disruption'
      }
    };
    
    const badge = badges[status] || badges.operational;
    const Icon = badge.icon;
    
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${badge.color}`}>
        <Icon size={20} />
        <span className="font-semibold">{badge.text}</span>
      </div>
    );
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading system status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">System Status</h1>
          <p className="text-gray-600">Monitor all services, APIs, and system resources</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={testAllServices}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Activity size={18} />
            Test All Services
          </button>
          <button
            onClick={() => loadSystemHealth()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            {getOverallStatusBadge()}
          </div>
          <div className="text-right text-sm text-gray-600">
            Last checked: {new Date(health?.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Services Status */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Services Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {health?.services && Object.entries(health.services).map(([service, data]) => (
            <ServiceStatusCard
              key={service}
              service={service}
              data={data}
              onTest={testService}
            />
          ))}
        </div>
      </div>

      {/* System Resources */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">System Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResourceUsageCard type="cpu" data={resources?.cpu} />
          <ResourceUsageCard type="memory" data={resources?.memory} />
          <ResourceUsageCard type="disk" data={resources?.disk} />
        </div>
      </div>

      {/* Queue Status Overview */}
      {health?.queues && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Queue Status</h2>
            <a
              href="/queue"
              className="flex items-center gap-1 text-blue-500 hover:text-blue-700 text-sm"
            >
              View Full Queue Monitor
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{health.queues.active}</div>
                <div className="text-sm text-gray-600 mt-1">Active Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{health.queues.waiting}</div>
                <div className="text-sm text-gray-600 mt-1">Waiting Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{health.queues.completedLastHour}</div>
                <div className="text-sm text-gray-600 mt-1">Completed (1h)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{health.queues.failedLastHour}</div>
                <div className="text-sm text-gray-600 mt-1">Failed (1h)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Information */}
      {systemInfo && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Environment Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Environment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Node.js Version:</span>
                  <span className="font-medium text-gray-800">{systemInfo.info.nodeVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OS:</span>
                  <span className="font-medium text-gray-800">{systemInfo.info.osType} {systemInfo.info.osRelease}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform:</span>
                  <span className="font-medium text-gray-800">{systemInfo.info.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Architecture:</span>
                  <span className="font-medium text-gray-800">{systemInfo.info.arch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">System Uptime:</span>
                  <span className="font-medium text-gray-800">{formatUptime(systemInfo.info.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Process Uptime:</span>
                  <span className="font-medium text-gray-800">{formatUptime(systemInfo.info.processUptime)}</span>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Configuration</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-600 mb-1">Queue Concurrency:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded">
                    <div>Script: {systemInfo.config.queueConcurrency.scriptGeneration}</div>
                    <div>Voice: {systemInfo.config.queueConcurrency.voiceGeneration}</div>
                    <div>Image: {systemInfo.config.queueConcurrency.imageGeneration}</div>
                    <div>Video: {systemInfo.config.queueConcurrency.videoAssembly}</div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Paths:</div>
                  <div className="space-y-1 text-xs bg-gray-50 p-2 rounded">
                    <div>Output: {systemInfo.config.paths.output}</div>
                    <div>Temp: {systemInfo.config.paths.temp}</div>
                    <div>Video Bank: {systemInfo.config.paths.videoBank}</div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Enabled Features:</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {systemInfo.config.features.claudeEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Claude</span>
                    )}
                    {systemInfo.config.features.falEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Fal.AI</span>
                    )}
                    {systemInfo.config.features.genaiproEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Genaipro</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemStatus;

