import { CheckCircle, XCircle, AlertTriangle, Loader, Server, Database, Activity } from 'lucide-react';

const ServiceStatusCard = ({ service, data, onTest }) => {
  const getStatusIcon = () => {
    if (!data) {
      return <Loader size={20} className="text-gray-400 animate-spin" />;
    }
    
    switch (data.status) {
      case 'healthy':
        return <CheckCircle size={20} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return <Loader size={20} className="text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    if (!data) return 'border-gray-300 bg-gray-50';
    
    switch (data.status) {
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getServiceIcon = () => {
    const iconClass = "text-gray-600";
    
    switch (service) {
      case 'redis':
        return <Database size={24} className={iconClass} />;
      case 'ffmpeg':
        return <Activity size={24} className={iconClass} />;
      default:
        return <Server size={24} className={iconClass} />;
    }
  };

  const getServiceName = () => {
    const names = {
      redis: 'Redis',
      claude: 'Claude API',
      fal: 'Fal.AI',
      genaipro: 'Genaipro.vn',
      assemblyai: 'AssemblyAI',
      ffmpeg: 'FFmpeg'
    };
    return names[service] || service;
  };

  return (
    <div className={`border-2 rounded-lg p-4 transition-all ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getServiceIcon()}
          <div>
            <h3 className="font-semibold text-gray-800">{getServiceName()}</h3>
            {data?.details && (
              <p className="text-xs text-gray-600 mt-1">{data.details}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
        </div>
      </div>

      {data && (
        <>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Response Time:</span>
            <span className="font-medium text-gray-800">{data.responseTime}ms</span>
          </div>

          {data.error && (
            <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
              {data.error}
            </div>
          )}

          <button
            onClick={() => onTest(service)}
            className="w-full mt-3 px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Test Now
          </button>
        </>
      )}

      {!data && (
        <div className="text-center text-gray-500 text-sm py-2">
          Checking...
        </div>
      )}
    </div>
  );
};

export default ServiceStatusCard;

