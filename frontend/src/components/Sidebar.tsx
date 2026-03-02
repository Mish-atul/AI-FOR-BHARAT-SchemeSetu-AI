'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, MessageSquare, Search, BarChart3,
  User, Settings, Shield, LogOut, Menu, X, Globe, WifiOff, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { logout } from '@/lib/api';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' as const },
  { href: '/documents', icon: FileText, labelKey: 'documents' as const },
  { href: '/chatbot', icon: MessageSquare, labelKey: 'chatbot' as const },
  { href: '/schemes', icon: Search, labelKey: 'schemes' as const },
  { href: '/reports', icon: BarChart3, labelKey: 'reports' as const },
  { href: '/profile', icon: User, labelKey: 'profile' as const },
];

const secondaryNavItems = [
  { href: '/verify', icon: Shield, labelKey: 'verify' as const },
  { href: '/csc', icon: FileText, labelKey: 'cscPortal' as const },
  { href: '/settings', icon: Settings, labelKey: 'settings' as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { language, setLanguage, isOnline, draftCount, sidebarOpen, setSidebarOpen } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    useAppStore.getState().setAuthenticated(false);
    useAppStore.getState().setUser(null);
    router.push('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-16",
          "lg:relative"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 via-white to-green-600 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-900">SS</span>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-orange-500 to-green-600 bg-clip-text text-transparent">
                SchemeSetu
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="mx-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <WifiOff className="h-3 w-3 shrink-0" />
            {sidebarOpen && <span>{t('offlineMode', language)}</span>}
          </div>
        )}

        {/* Draft count */}
        {draftCount > 0 && sidebarOpen && (
          <div className="mx-2 mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
            {draftCount} {t('draftsPending', language)}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gradient-to-r from-orange-50 to-green-50 text-orange-700 dark:from-orange-900/20 dark:to-green-900/20 dark:text-orange-400"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-orange-600")} />
                  {sidebarOpen && <span>{t(item.labelKey, language)}</span>}
                </div>
              </Link>
            );
          })}

          <Separator className="my-3" />

          {secondaryNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span>{t(item.labelKey, language)}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <Button
            variant="ghost"
            size={sidebarOpen ? "default" : "icon"}
            onClick={toggleLanguage}
            className="w-full justify-start gap-3"
          >
            <Globe className="h-5 w-5 shrink-0" />
            {sidebarOpen && (
              <span className="text-sm">{language === 'en' ? 'हिंदी' : 'English'}</span>
            )}
            {sidebarOpen && (
              <Badge variant="outline" className="ml-auto text-xs">
                {language.toUpperCase()}
              </Badge>
            )}
          </Button>

          <Button
            variant="ghost"
            size={sidebarOpen ? "default" : "icon"}
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="text-sm">{t('logout', language)}</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
