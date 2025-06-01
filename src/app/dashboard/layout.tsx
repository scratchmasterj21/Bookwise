
"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { CalendarDays, CalendarPlus, View, Laptop, Monitor } from 'lucide-react';

const dashboardTabs = [
  { name: 'My Reservations', href: '/dashboard', icon: CalendarDays },
  { name: 'Book Room (Weekly)', href: '/dashboard/book-item', icon: CalendarPlus },
  { name: 'Book Room (Daily)', href: '/dashboard/daily-bookings', icon: View },
  { name: 'Book Device (Weekly)', href: '/dashboard/book-device-weekly', icon: Laptop },
  { name: 'Book Device (Daily)', href: '/dashboard/book-device-daily', icon: Monitor },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const activeTabValue = dashboardTabs.reduce((acc, tab) => {
    if (pathname.startsWith(tab.href) && tab.href.length > acc.length) {
      return tab.href;
    }
    return acc;
  }, dashboardTabs.find(tab => tab.href === '/dashboard')?.href || '/dashboard');
  
  return (
    <AuthGuard>
      <div className="space-y-6 animate-subtle-slide-up">
        <h1 className="text-3xl font-headline font-semibold">User Dashboard</h1>
        <Tabs value={activeTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"> {/* Adjusted for better flow */}
            {dashboardTabs.map((tab) => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <Link href={tab.href} className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-center">
                  <tab.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{tab.name}</span>
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-6">{children}</div>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
