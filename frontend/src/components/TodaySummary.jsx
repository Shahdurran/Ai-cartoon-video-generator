import { useState, useEffect } from 'react';
import { TrendingUp, Clock, Film, Star } from 'lucide-react';
import { dashboardAPI } from '../services/api';

const TodaySummary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getTodaySummary();
      setSummary(response.summary);
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const SummaryItem = ({ icon: Icon, label, value, color }) => (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
      <div className={`p-2 rounded-full ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Summary</h2>
      <div className="grid grid-cols-1 gap-4">
        <SummaryItem
          icon={TrendingUp}
          label="Videos Generated"
          value={summary.videosGeneratedToday}
          color="bg-blue-500"
        />
        <SummaryItem
          icon={Clock}
          label="Total Processing Time"
          value={formatTime(summary.totalProcessingTimeToday)}
          color="bg-green-500"
        />
        <SummaryItem
          icon={Film}
          label="Avg Video Length"
          value={formatTime(summary.avgVideoLength)}
          color="bg-purple-500"
        />
        <SummaryItem
          icon={Star}
          label="Most Used Channel"
          value={summary.mostUsedChannel}
          color="bg-yellow-500"
        />
      </div>
    </div>
  );
};

export default TodaySummary;

