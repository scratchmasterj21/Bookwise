"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { CalendarDays, Laptop, DoorOpen } from 'lucide-react';

const dashboardTabs = [
  { name: 'My Reservations', href: '/dashboard', icon: CalendarDays },
  { name: 'Book Device', href: '/dashboard/book-device', icon: Laptop },
  { name: 'Book Room', href: '/dashboard/book-room', icon: DoorOpen },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Determine active tab, default to '/dashboard' if specific sub-route isn't matched
  const activeTabValue = dashboardTabs.find(tab => pathname === tab.href)?.href || '/dashboard';
  
  return (
    <AuthGuard>
      <div className="space-y-6 animate-subtle-slide-up">
        <h1 className="text-3xl font-headline font-semibold">User Dashboard</h1>
        <Tabs value={activeTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:max-w-md">
            {dashboardTabs.map((tab) => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <Link href={tab.href} className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Content is rendered by child page.tsx based on route */}
          <div className="mt-6">{children}</div>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
