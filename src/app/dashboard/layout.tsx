
"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { CalendarDays, CalendarPlus } from 'lucide-react';

const dashboardTabs = [
  { name: 'My Reservations', href: '/dashboard', icon: CalendarDays },
  { name: 'Book a Room', href: '/dashboard/book-item', icon: CalendarPlus }, // Updated name
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const activeTabValue = dashboardTabs.find(tab => pathname.startsWith(tab.href))?.href || '/dashboard';
  
  return (
    <AuthGuard>
      <div className="space-y-6 animate-subtle-slide-up">
        <h1 className="text-3xl font-headline font-semibold">User Dashboard</h1>
        <Tabs value={activeTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:max-w-xs">
            {dashboardTabs.map((tab) => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <Link href={tab.href} className="flex items-center gap-2">
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
