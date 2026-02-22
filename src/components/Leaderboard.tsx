import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Star, Trophy, Target, Heart, TrendingUp, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'allTime'>('weekly');

  const leaders = [
    { rank: 1, name: 'Rahul Sharma', points: 2450, badges: ['Super Donor', 'Life Saver'], avatar: 'R' },
    { rank: 2, name: 'Priya Singh', points: 2100, badges: ['Rapid Responder'], avatar: 'P' },
    { rank: 3, name: 'Amit Patel', points: 1850, badges: ['Community Hero'], avatar: 'A' },
    { rank: 4, name: 'Sneha Gupta', points: 1600, badges: [], avatar: 'S' },
    { rank: 5, name: 'Vikram M.', points: 1450, badges: [], avatar: 'V' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Donor Leaderboard
            </h3>
            <p className="text-slate-400 text-sm mt-1">Top heroes making a difference</p>
          </div>
          <div className="bg-white/10 p-1 rounded-lg flex text-xs font-medium">
            <button
              onClick={() => setActiveTab('weekly')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-all",
                activeTab === 'weekly' ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              )}
            >
              Weekly
            </button>
            <button
              onClick={() => setActiveTab('allTime')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-all",
                activeTab === 'allTime' ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              )}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="flex justify-center items-end gap-4 mb-4">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-slate-600 bg-slate-700 flex items-center justify-center text-xl font-bold mb-2 relative">
              {leaders[1].avatar}
              <div className="absolute -bottom-2 bg-slate-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">2</div>
            </div>
            <div className="text-sm font-medium">{leaders[1].name}</div>
            <div className="text-xs text-slate-400">{leaders[1].points} pts</div>
            <div className="h-16 w-16 bg-slate-700/50 rounded-t-lg mt-2" />
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full border-4 border-yellow-400 bg-slate-700 flex items-center justify-center text-2xl font-bold mb-2 relative shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              <Crown className="absolute -top-6 w-8 h-8 text-yellow-400" />
              {leaders[0].avatar}
              <div className="absolute -bottom-2 bg-yellow-400 text-slate-900 text-xs px-2 py-0.5 rounded-full font-bold">1</div>
            </div>
            <div className="text-sm font-bold text-yellow-400">{leaders[0].name}</div>
            <div className="text-xs text-slate-300">{leaders[0].points} pts</div>
            <div className="h-24 w-20 bg-gradient-to-t from-yellow-400/20 to-yellow-400/5 rounded-t-lg mt-2 border-t border-yellow-400/20" />
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-orange-700 bg-slate-700 flex items-center justify-center text-xl font-bold mb-2 relative">
              {leaders[2].avatar}
              <div className="absolute -bottom-2 bg-orange-700 text-white text-xs px-2 py-0.5 rounded-full font-bold">3</div>
            </div>
            <div className="text-sm font-medium">{leaders[2].name}</div>
            <div className="text-xs text-slate-400">{leaders[2].points} pts</div>
            <div className="h-12 w-16 bg-slate-700/50 rounded-t-lg mt-2" />
          </div>
        </div>
      </div>

      {/* List View */}
      <div className="divide-y divide-slate-100">
        {leaders.slice(3).map((leader) => (
          <div key={leader.rank} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-8 font-bold text-slate-400 text-center">{leader.rank}</div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
              {leader.avatar}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900">{leader.name}</div>
              <div className="flex gap-1 mt-1">
                {leader.badges.map((badge, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="font-bold text-slate-900">{leader.points} <span className="text-xs text-slate-400 font-normal">pts</span></div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
        <button className="text-sm text-red-600 font-medium hover:text-red-700 flex items-center justify-center gap-2 w-full">
          View Full Leaderboard <TrendingUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Crown({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M11.9998 3L14.8998 9.5L21.9998 10.5L16.9998 15.5L18.4998 22.5L11.9998 19.5L5.4998 22.5L6.9998 15.5L1.9998 10.5L9.0998 9.5L11.9998 3Z" />
    </svg>
  );
}
