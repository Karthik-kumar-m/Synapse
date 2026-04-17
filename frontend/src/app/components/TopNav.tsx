import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, ChevronDown, Calendar, Settings, X, Moon, Sun, Monitor, BellRing, LogOut, CheckCircle2, HardDriveUpload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const notifications = [
  { id: 1, text: 'Spike in negative reviews detected (Battery)', time: '2m ago', type: 'critical' },
  { id: 2, text: 'New anomaly found on April 11', time: '1h ago', type: 'warning' },
  { id: 3, text: 'Weekly intelligence report ready', time: '5h ago', type: 'info' },
];

export function TopNav({ 
  dateFilter, 
  setDateFilter, 
  category, 
  setCategory,
  isSettingsOpen,
  setIsSettingsOpen
}: { 
  dateFilter: string, 
  setDateFilter: (v: string) => void,
  category: string,
  setCategory: (v: string) => void,
  isSettingsOpen: boolean,
  setIsSettingsOpen: (v: boolean) => void
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const categoryRef = React.useRef<HTMLDivElement>(null);
  const dateRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isCategoryOpen && categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (isDateOpen && dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
      if (isNotifOpen && notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCategoryOpen, isDateOpen, isNotifOpen]);

  const handleDateSelect = (val: string) => {
    setDateFilter(val);
    setIsDateOpen(false);
    navigate('/');
  };

  const handleCategorySelect = (val: string) => {
    setCategory(val);
    setIsCategoryOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="h-[72px] bg-[#F5F5F7]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8 border-b border-[#E5E5EA]/30">
        
        {/* Breadcrumb / Category */}
        <div className="relative" ref={categoryRef}>
          <div 
            className="flex items-center text-[13px] font-medium tracking-tight cursor-pointer hover:bg-black/5 px-3 py-1.5 rounded-full transition-colors -ml-3"
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          >
            <span className="text-[#86868B]">Synapse</span>
            <span className="text-[#86868B] mx-2">/</span>
            <span className="text-[#1D1D1F]">{category}</span>
            <ChevronDown size={14} className="text-[#86868B] ml-2" strokeWidth={2.5} />
          </div>

          <AnimatePresence>
            {isCategoryOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-10 left-0 w-56 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E5E5EA] overflow-hidden p-2 z-50"
              >
                {['Consumer Electronics', 'Home Appliances', 'Software Services'].map(cat => (
                  <div 
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className={`px-3 py-2 text-[13px] font-medium rounded-xl cursor-pointer flex items-center justify-between transition-colors ${category === cat ? 'bg-[#0071E3]/10 text-[#0071E3]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'}`}
                  >
                    {cat}
                    {category === cat && <CheckCircle2 size={14} />}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex items-center gap-4">
          
          {/* Action Button */}
          <button 
            onClick={() => navigate('/ingest')}
            className="flex items-center gap-2 bg-[#0071E3] text-white px-4 py-1.5 rounded-full text-[13px] font-semibold hover:bg-[#005bb5] transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:shadow-[0_4px_12px_rgba(0,113,227,0.35)] hover:scale-105 active:scale-95"
          >
            <HardDriveUpload size={14} strokeWidth={2.5} />
            <span>Ingest Reviews</span>
          </button>
          
          {/* Date Filter */}
          <div className="relative" ref={dateRef}>
            <div 
              className="flex items-center gap-2 text-[13px] font-medium text-[#1D1D1F] cursor-pointer hover:bg-black/5 px-3 py-1.5 rounded-full transition-colors"
              onClick={() => setIsDateOpen(!isDateOpen)}
            >
              <Calendar size={14} className="text-[#86868B]" strokeWidth={2.5} />
              <span>{dateFilter}</span>
              <ChevronDown size={14} className="text-[#86868B]" strokeWidth={2.5} />
            </div>

            <AnimatePresence>
              {isDateOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-10 right-0 w-48 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E5E5EA] overflow-hidden p-2 z-50"
                >
                  {['Last 7 Days', 'Last 30 Days', 'Last 3 Months'].map(date => (
                    <div 
                      key={date}
                      onClick={() => handleDateSelect(date)}
                      className={`px-3 py-2 text-[13px] font-medium rounded-xl cursor-pointer flex items-center justify-between transition-colors ${dateFilter === date ? 'bg-[#0071E3]/10 text-[#0071E3]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'}`}
                    >
                      {date}
                      {dateFilter === date && <CheckCircle2 size={14} />}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <div 
              className={`p-2 cursor-pointer rounded-full transition-colors ${isNotifOpen ? 'bg-black/10' : 'hover:bg-black/5'}`}
              onClick={() => setIsNotifOpen(!isNotifOpen)}
            >
              <Bell size={18} className="text-[#1D1D1F]" strokeWidth={2} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] ring-2 ring-[#F5F5F7]"></span>
            </div>

            <AnimatePresence>
              {isNotifOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, transformOrigin: 'top right' }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E5E5EA] overflow-hidden z-50 flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-[#E5E5EA] flex items-center justify-between bg-[#F5F5F7]/50">
                    <h4 className="text-[14px] font-semibold text-[#1D1D1F]">Notifications</h4>
                    <span className="text-[12px] font-medium text-[#0071E3] cursor-pointer hover:underline">Mark all read</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                    {notifications.map(n => (
                      <div key={n.id} className="p-3 rounded-xl hover:bg-[#F5F5F7] transition-colors cursor-pointer flex gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'critical' ? 'bg-[#FF3B30]' : n.type === 'warning' ? 'bg-[#FF9500]' : 'bg-[#0071E3]'}`} />
                        <div>
                          <p className="text-[13px] text-[#1D1D1F] font-medium leading-tight">{n.text}</p>
                          <p className="text-[11px] text-[#86868B] font-medium mt-1">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings / Account */}
          <div 
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0071E3] to-[#409CFF] text-white flex items-center justify-center text-[13px] font-bold shadow-sm cursor-pointer hover:shadow-md transition-all hover:scale-105"
            onClick={() => setIsSettingsOpen(true)}
          >
            JS
          </div>
        </div>
      </header>

      {/* Settings Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-[320px] bg-[#F5F5F7] shadow-2xl z-50 border-l border-[#E5E5EA] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-[#E5E5EA]/50 bg-white">
                <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-full hover:bg-[#F5F5F7] text-[#86868B] transition-colors"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Account */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-4">Account</h4>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E5EA]/50 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0071E3] to-[#409CFF] text-white flex items-center justify-center text-lg font-bold">
                      JS
                    </div>
                    <div>
                      <h5 className="text-[14px] font-semibold text-[#1D1D1F]">Jane Smith</h5>
                      <p className="text-[13px] text-[#86868B] font-medium">jane.smith@synapse.com</p>
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-4">Appearance</h4>
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA]/50 overflow-hidden divide-y divide-[#E5E5EA]/50">
                    <div 
                      onClick={toggleDarkMode}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F5F5F7] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Moon size={16} className="text-[#1D1D1F]" />
                        <span className="text-[14px] font-medium text-[#1D1D1F]">Dark Mode</span>
                      </div>
                      <div className={`w-10 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${isDarkMode ? 'left-[18px]' : 'left-0.5'}`}></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F5F5F7] transition-colors">
                      <div className="flex items-center gap-3">
                        <Monitor size={16} className="text-[#1D1D1F]" />
                        <span className="text-[14px] font-medium text-[#1D1D1F]">System Preference</span>
                      </div>
                      <div className="w-10 h-6 bg-[#34C759] rounded-full relative transition-colors">
                        <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider mb-4">Preferences</h4>
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA]/50 overflow-hidden divide-y divide-[#E5E5EA]/50">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F5F5F7] transition-colors">
                      <div className="flex items-center gap-3">
                        <BellRing size={16} className="text-[#1D1D1F]" />
                        <span className="text-[14px] font-medium text-[#1D1D1F]">Anomaly Alerts</span>
                      </div>
                      <div className="w-10 h-6 bg-[#34C759] rounded-full relative transition-colors">
                        <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F5F5F7] transition-colors text-[#FF3B30]">
                      <div className="flex items-center gap-3">
                        <LogOut size={16} />
                        <span className="text-[14px] font-medium">Log Out</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}