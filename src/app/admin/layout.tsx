
"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ListChecks, HardDrive, Building, Settings, Warehouse } from 'lucide-react'; // Added Warehouse for Buildings

const adminTabs = [
  { name: 'Manage Reservations', href: '/admin', icon: ListChecks },
  { name: 'Manage Devices', href: '/admin/devices', icon: HardDrive },
  { name: 'Manage Rooms', href: '/admin/rooms', icon: Building },
  { name: 'Manage Buildings', href: '/admin/buildings', icon: Warehouse }, // New tab for Buildings
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTabValue = adminTabs.find(tab => pathname.startsWith(tab.href))?.href || '/admin';

  return (
    <AuthGuard adminOnly={true}>
      <div className="space-y-6 animate-subtle-slide-up">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" /> Admin Panel
          </h1>
        </div>
        <Tabs value={activeTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-4 md:max-w-xl"> {/* Adjusted for 4 tabs */}
            {adminTabs.map((tab) => (
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
