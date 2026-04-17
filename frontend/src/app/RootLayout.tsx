import React, { useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';

export type DashboardContextType = {
  dateFilter: string;
  category: string;
  selectedProductId: string;
  setSelectedProductId: (productId: string) => void;
};

export function RootLayout() {
  const [dateFilter, setDateFilter] = useState('Last 30 Days');
  const [category, setCategory] = useState('Consumer Electronics');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans antialiased selection:bg-[#0071E3] selection:text-white flex">
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="flex-1 ml-20 flex flex-col min-w-0 bg-[#F5F5F7] relative">
        <TopNav 
          dateFilter={dateFilter} 
          setDateFilter={setDateFilter} 
          category={category} 
          setCategory={setCategory}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
        />
        <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 flex flex-col gap-6 relative">
          <Outlet
            context={{
              dateFilter,
              category,
              selectedProductId,
              setSelectedProductId,
            } satisfies DashboardContextType}
          />
        </div>
      </main>
    </div>
  );
}