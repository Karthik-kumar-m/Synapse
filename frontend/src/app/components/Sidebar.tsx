import React from 'react';
import { NavLink } from 'react-router';
import { LayoutDashboard, Database, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true },
  { name: 'Reviews / Data', path: '/reviews', icon: Database },
  { name: 'Insights / Users', path: '/insights', icon: BarChart2 },
];

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <aside className="w-20 bg-[#F5F5F7] h-screen fixed left-0 top-0 border-r border-[#E5E5EA]/50 flex flex-col items-center pt-6 pb-8 z-20">
      <div className="mb-10">
        <div className="w-10 h-10 rounded-[14px] bg-[#1D1D1F] flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-105">
          <div className="w-4 h-4 bg-white rounded-full"></div>
        </div>
      </div>
      
      <nav className="flex-1 w-full">
        <ul className="space-y-4 flex flex-col items-center">
          {navItems.map((item) => (
            <li key={item.name} className="relative group">
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center justify-center w-12 h-12 rounded-[16px] transition-all duration-300 ${
                    isActive
                      ? 'bg-[#0071E3]/10 text-[#0071E3] shadow-[0_4px_12px_rgba(0,113,227,0.15)] scale-105'
                      : 'text-[#86868B] hover:bg-[#E5E5EA]/50 hover:text-[#1D1D1F] hover:scale-105'
                  }`
                }
              >
                {({ isActive }) => (
                  <item.icon
                    size={20}
                    className={isActive ? 'text-[#0071E3]' : ''}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
              </NavLink>
              {/* Tooltip */}
              <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1D1D1F] text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.name}
              </div>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="mt-auto relative group">
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center w-12 h-12 rounded-[16px] transition-all duration-300 text-[#86868B] hover:bg-[#E5E5EA]/50 hover:text-[#1D1D1F] hover:scale-105"
        >
          <Settings size={20} strokeWidth={2} />
        </button>
        <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1D1D1F] text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          Settings
        </div>
      </div>
    </aside>
  );
}
