import { Cpu, HardDrive, Activity } from 'lucide-react';

const ResourceUsageCard = ({ type, data }) => {
  const getIcon = () => {
    const icons = {
      cpu: Cpu,
      memory: Activity,
      disk: HardDrive
    };
    const Icon = icons[type] || Activity;
    return <Icon size={24} className="text-gray-600" />;
  };

  const getTitle = () => {
    const titles = {
      cpu: 'CPU Usage',
      memory: 'Memory Usage',
      disk: 'Disk Space'
    };
    return titles[type] || type;
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatBytes = (mb) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          {getIcon()}
          <h3 className="font-semibold text-gray-800">{getTitle()}</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        {getIcon()}
        <h3 className="font-semibold text-gray-800">{getTitle()}</h3>
      </div>

      {type === 'cpu' && (
        <>
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Current Usage</span>
              <span className="text-2xl font-bold text-gray-800">{data.usage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getStatusColor(data.usage)}`}
                style={{ width: `${data.usage}%` }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-600">Cores</div>
              <div className="font-semibold text-gray-800">{data.cores}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-600">Load Avg</div>
              <div className="font-semibold text-gray-800">{data.loadAvg?.[0]?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        </>
      )}

      {type === 'memory' && (
        <>
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Used / Total</span>
              <span className="text-sm font-semibold text-gray-800">
                {formatBytes(data.used)} / {formatBytes(data.total)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getStatusColor(data.percentage)}`}
                style={{ width: `${data.percentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-600 mt-1">{data.percentage}%</div>
          </div>
          {data.process && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600 mb-2">Node.js Process</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-600">Heap Used</div>
                  <div className="font-semibold text-gray-800">{data.process.heapUsed} MB</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-gray-600">RSS</div>
                  <div className="font-semibold text-gray-800">{data.process.rss} MB</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {type === 'disk' && (
        <>
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Used / Total</span>
              <span className="text-sm font-semibold text-gray-800">
                {data.used} GB / {data.total} GB
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getStatusColor(data.percentage)}`}
                style={{ width: `${data.percentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-600 mt-1">
              {data.free} GB free ({data.percentage}% used)
            </div>
          </div>
          
          {data.folders && Object.keys(data.folders).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600 mb-2">Folder Sizes</div>
              <div className="space-y-1 text-xs">
                {Object.entries(data.folders).map(([folder, size]) => (
                  <div key={folder} className="flex items-center justify-between">
                    <span className="text-gray-600">{folder}/</span>
                    <span className="font-medium text-gray-800">{size} MB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {data.free < 10 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
              ⚠️ Low disk space warning
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResourceUsageCard;

