import React, { useState } from 'react';
import { Droplets, AlertTriangle, Plus, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

interface InventoryItem {
  type: BloodType;
  units: number;
  status: 'critical' | 'low' | 'good' | 'full';
}

export default function InventoryManager() {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { type: 'A+', units: 45, status: 'good' },
    { type: 'A-', units: 12, status: 'low' },
    { type: 'B+', units: 50, status: 'full' },
    { type: 'B-', units: 8, status: 'critical' },
    { type: 'AB+', units: 25, status: 'good' },
    { type: 'AB-', units: 5, status: 'critical' },
    { type: 'O+', units: 60, status: 'full' },
    { type: 'O-', units: 15, status: 'low' },
  ]);

  const updateUnits = (type: BloodType, change: number) => {
    setInventory(prev => prev.map(item => {
      if (item.type === type) {
        const newUnits = Math.max(0, item.units + change);
        let status: InventoryItem['status'] = 'good';
        if (newUnits < 10) status = 'critical';
        else if (newUnits < 20) status = 'low';
        else if (newUnits > 48) status = 'full';
        
        return { ...item, units: newUnits, status };
      }
      return item;
    }));
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-red-600" />
            Blood Bank Inventory
          </h3>
          <p className="text-sm text-slate-500">Live stock levels & auto-alerts</p>
        </div>
        <button className="p-2 text-slate-400 hover:text-red-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {inventory.map((item) => (
          <div 
            key={item.type}
            className={cn(
              "p-4 rounded-xl border relative overflow-hidden transition-all",
              item.status === 'critical' ? "bg-red-50 border-red-200" :
              item.status === 'low' ? "bg-orange-50 border-orange-200" :
              "bg-white border-slate-200"
            )}
          >
            {item.status === 'critical' && (
              <div className="absolute top-2 right-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            )}
            
            <div className="text-2xl font-bold text-slate-900 mb-1">{item.type}</div>
            <div className={cn(
              "text-sm font-medium mb-3",
              item.status === 'critical' ? "text-red-600" :
              item.status === 'low' ? "text-orange-600" :
              "text-slate-500"
            )}>
              {item.units} Units
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateUnits(item.type, -1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button 
                onClick={() => updateUnits(item.type, 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
