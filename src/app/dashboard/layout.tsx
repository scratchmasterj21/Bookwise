
"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { CalendarDays, CalendarPlus, View, Laptop, Monitor } from 'lucide-react'; // Added Laptop, Monitor

const dashboardTabs = [
  { name: 'My Reservations', href: '/dashboard', icon: CalendarDays },
  { name: 'Book Room (Week)', href: '/dashboard/book-item', icon: CalendarPlus },
  { name: 'Book Room (Day)', href: '/dashboard/daily-bookings', icon: View },
  { name: 'Book Device (Week)', href: '/dashboard/book-device-weekly', icon: Laptop }, // New Tab for Weekly Device Booking
  { name: 'Book Device (Day)', href: '/dashboard/book-device-daily', icon: Monitor }, // New Tab for Daily Device Booking
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Find the best match, prioritizing longer paths for more specific routes
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 md:max-w-3xl"> {/* Adjusted for 5 tabs */}
            {dashboardTabs.map((tab) => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <Link href={tab.href} className="flex items-center gap-2 text-xs sm:text-sm">
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
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
