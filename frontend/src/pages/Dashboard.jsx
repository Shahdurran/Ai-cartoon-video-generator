import { useState, useEffect } from 'react';
import { Video, Layers, Clock, CheckCircle } from 'lucide-react';
import { channelAPI, videoAPI, dashboardAPI } from '../services/api';
import AnalyticsCharts from '../components/AnalyticsCharts';
import RecentActivityFeed from '../components/RecentActivityFeed';
import TodaySummary from '../components/TodaySummary';

const Dashboard = () => {
  const [stats, setStats] = useState({
    channels: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadAnalytics();
  }, []);

  const loadStats = async () => {
    try {
      const [channelsData, queueData] = await Promise.all([
        channelAPI.getAll(),
        videoAPI.getQueue(),
      ]);

      const channels = channelsData.channels || [];
      let activeJobs = 0;
      let completedJobs = 0;
      let failedJobs = 0;

      // Count jobs by status
      if (queueData.jobs) {
        const allJobs = [];
        
        if (Array.isArray(queueData.jobs)) {
          allJobs.push(...queueData.jobs);
        } else {
          Object.values(queueData.jobs).forEach(queueJobs => {
            if (Array.isArray(queueJobs)) {
              allJobs.push(...queueJobs);
            }
          });
        }

        allJobs.forEach(job => {
          const status = job.state || job.status;
          if (status === 'active' || status === 'waiting') {
            activeJobs++;
          } else if (status === 'completed') {
            completedJobs++;
          } else if (status === 'failed') {
            failedJobs++;
          }
        });
      }

      setStats({
        channels: channels.length,
        activeJobs,
        completedJobs,
        failedJobs,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await dashboardAPI.getAnalytics('7days');
      setAnalytics(response.analytics);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  const SkeletonLoader = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to the Video Generation System</p>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          title="Channels"
          value={stats.channels}
          color="bg-blue-500"
        />
        <StatCard
          icon={Clock}
          title="Active Jobs"
          value={stats.activeJobs}
          color="bg-yellow-500"
        />
        <StatCard
          icon={CheckCircle}
          title="Completed"
          value={stats.completedJobs}
          color="bg-green-500"
        />
        <StatCard
          icon={Video}
          title="Failed"
          value={stats.failedJobs}
          color="bg-red-500"
        />
      </div>

      {/* Analytics Charts */}
      {analyticsLoading ? (
        <SkeletonLoader />
      ) : (
        <AnalyticsCharts analytics={analytics} />
      )}

      {/* Two Column Layout for Activity Feed and Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed - Takes 2 columns */}
        <div className="lg:col-span-2">
          <RecentActivityFeed />
        </div>

        {/* Today's Summary - Takes 1 column */}
        <div className="lg:col-span-1">
          <TodaySummary />
          
          {/* Quick Start Guide - Moved here */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Start</h2>
            <div className="space-y-3 text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-800">Create a Channel</p>
                  <p className="text-sm">
                    Go to the Channels tab and create your first channel with custom settings
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-800">Generate Videos</p>
                  <p className="text-sm">
                    Use the Generate tab to create videos with AI-generated scripts and images
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-800">Monitor Progress</p>
                  <p className="text-sm">
                    Check the Queue tab to monitor your video generation jobs in real-time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

