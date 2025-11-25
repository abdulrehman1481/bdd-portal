'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'red' | 'blue' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  red: 'from-red-500 to-pink-500',
  blue: 'from-blue-500 to-cyan-500',
  green: 'from-green-500 to-emerald-500',
  purple: 'from-purple-500 to-indigo-500',
  orange: 'from-orange-500 to-amber-500',
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'red',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p
              className={clsx('text-sm mt-2', {
                'text-green-600': trend.isPositive,
                'text-red-600': !trend.isPositive,
              })}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div
          className={clsx(
            'w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br',
            colorClasses[color]
          )}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
