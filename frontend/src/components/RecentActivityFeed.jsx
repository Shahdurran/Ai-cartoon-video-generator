import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, Folder, Video } from 'lucide-react';
import { dashboardAPI } from '../services/api';

const RecentActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadActivities(true); // Silent refresh
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadActivities = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await dashboardAPI.getRecentActivity();
      setActivities(response.activities || []);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getActivityIcon = (type, status) => {
    if (status === 'failed') return <XCircle size={20} className="text-red-500" />;
    if (status === 'processing') return <Clock size={20} className="text-yellow-500" />;
    if (status === 'completed') return <CheckCircle size={20} className="text-green-500" />;
    return <Video size={20} className="text-blue-500" />;
  };

  const getActivityDescription = (activity) => {
    switch (activity.status) {
      case 'completed':
        return `Video completed in ${activity.metadata?.duration || 0}s`;
      case 'failed':
        return `Failed: ${activity.metadata?.error || 'Unknown error'}`;
      case 'processing':
        return `Processing... ${activity.metadata?.progress || 0}%`;
      default:
        return 'Activity';
    }
  };

  const handleAction = (activity) => {
    if (activity.status === 'failed') {
      // Retry logic would go here
      console.log('Retry job:', activity.id);
    } else if (activity.status === 'completed') {
      // View logic would go here
      console.log('View video:', activity.id);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
        <button
          onClick={() => loadActivities()}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Video size={48} className="mx-auto mb-3 opacity-50" />
          <p>No recent activity</p>
          <p className="text-sm mt-1">Start generating videos to see activity here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={`${activity.id}-${activity.timestamp}`}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.type, activity.status)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {activity.title}
                </p>
                <p className="text-sm text-gray-600">
                  {getActivityDescription(activity)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {activity.timeAgo}
                </p>
              </div>

              <div className="flex-shrink-0">
                {activity.status === 'completed' && (
                  <button
                    onClick={() => handleAction(activity)}
                    className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors"
                    title="View"
                  >
                    <Eye size={18} />
                  </button>
                )}
                {activity.status === 'failed' && (
                  <button
                    onClick={() => handleAction(activity)}
                    className="text-yellow-500 hover:text-yellow-700 p-2 hover:bg-yellow-50 rounded transition-colors"
                    title="Retry"
                  >
                    <RefreshCw size={18} />
                  </button>
                )}
                {activity.status === 'processing' && (
                  <div className="text-xs text-gray-500 p-2">
                    {activity.metadata?.progress || 0}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivityFeed;

