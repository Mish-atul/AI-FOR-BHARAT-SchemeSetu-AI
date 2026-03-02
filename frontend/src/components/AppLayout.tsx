'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useAppStore } from '@/lib/store';
import { isAuthenticated, getProfile } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser, setAuthenticated, sidebarOpen } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    setAuthenticated(true);
    getProfile().then((user) => {
      setUser(user);
      setLoading(false);
    }).catch(() => {
      router.push('/login');
    });
  }, [router, setUser, setAuthenticated]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => useAppStore.getState().setOnline(true);
    const handleOffline = () => useAppStore.getState().setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    useAppStore.getState().setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 via-white to-green-600 animate-pulse flex items-center justify-center">
            <span className="text-sm font-bold text-blue-900">SS</span>
          </div>
          <p className="text-gray-500 animate-pulse">Loading SchemeSetu AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'}`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
