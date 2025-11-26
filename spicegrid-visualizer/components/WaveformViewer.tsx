import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PWLPoint } from '../types';

interface WaveformViewerProps {
  data: PWLPoint[];
  title: string;
  onClose: () => void;
}

const WaveformViewer: React.FC<WaveformViewerProps> = ({ data, title, onClose }) => {
  // Format numbers for axis
  const formatTime = (val: number) => {
    if (val === 0) return '0';
    if (val < 1e-6) return `${(val * 1e9).toFixed(1)}ns`;
    return `${val}`;
  };

  return (
    <div className="absolute top-4 right-4 z-50 bg-gray-800 border border-gray-700 shadow-2xl rounded-lg p-4 w-96 h-64 animate-in fade-in slide-in-from-top-4">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-200">{title} PWL Output</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
                dataKey="time" 
                tickFormatter={formatTime} 
                stroke="#9ca3af" 
                fontSize={10}
            />
            <YAxis stroke="#9ca3af" fontSize={10} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }}
                labelFormatter={(label) => `Time: ${label}s`}
                formatter={(value: number) => [`${value}V`, 'Voltage']}
            />
            <Line type="stepAfter" dataKey="voltage" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WaveformViewer;