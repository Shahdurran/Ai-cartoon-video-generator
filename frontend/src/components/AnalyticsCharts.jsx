import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AnalyticsCharts = ({ analytics }) => {
  if (!analytics) return null;

  const { dailyVideoCounts, processingTimes, successRate } = analytics;

  // Colors for bar chart based on processing time
  const getBarColor = (seconds) => {
    if (seconds < 60) return '#10b981'; // green
    if (seconds < 300) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  // Data for donut chart
  const successRateData = [
    { name: 'Success', value: successRate.success, color: '#10b981' },
    { name: 'Failed', value: successRate.failed, color: '#ef4444' }
  ];

  // Custom label for donut chart center
  const renderSuccessRateLabel = () => {
    return (
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
        <tspan x="50%" dy="-0.5em" fontSize="32" fontWeight="bold" fill="#1f2937">
          {successRate.percentage}%
        </tspan>
        <tspan x="50%" dy="1.5em" fontSize="14" fill="#6b7280">
          Success Rate
        </tspan>
      </text>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Video Generation Analytics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Videos Generated Per Day */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Videos Generated Per Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyVideoCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="label" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Videos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Processing Time Trends */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Processing Time Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processingTimes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="title" 
                stroke="#6b7280"
                style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                formatter={(value) => [`${value}s`, 'Processing Time']}
              />
              <Bar 
                dataKey="processingTime" 
                name="Time (s)"
                radius={[8, 8, 0, 0]}
              >
                {processingTimes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.processingTime)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">&lt;60s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-600">60-300s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">&gt;300s</span>
            </div>
          </div>
        </div>

        {/* Success Rate Donut Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Success Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={successRateData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
              >
                {successRateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              {renderSuccessRateLabel()}
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">Success</span>
              </div>
              <div className="text-2xl font-bold text-gray-800 mt-1">
                {successRate.success}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-600">Failed</span>
              </div>
              <div className="text-2xl font-bold text-gray-800 mt-1">
                {successRate.failed}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;

