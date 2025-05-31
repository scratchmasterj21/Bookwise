"use client";

import React, { useState, useEffect } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Device } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const initialMockDevices: Device[] = [
  { id: 'laptop100', name: 'Admin MacBook Pro 16"', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'For admin use.' },
  { id: 'tablet200', name: 'Admin Galaxy Tab S9', type: 'Tablet', status: 'maintenance', imageUrl: 'https://placehold.co/600x400.png', description: 'Undergoing software update.' },
];

export default function ManageDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setDevices(initialMockDevices);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveDevice = (deviceData: Partial<Device>) => {
    setIsLoading(true);
    setTimeout(() => {
      if (editingDevice) {
        setDevices(devices.map(d => d.id === editingDevice.id ? { ...d, ...deviceData } as Device : d));
        toast({ title: "Device Updated", description: `${deviceData.name} has been updated.` });
      } else {
        const newDevice = { ...deviceData, id: `device-${Date.now()}` } as Device; // Ensure ID and full type
        setDevices([...devices, newDevice]);
        toast({ title: "Device Added", description: `${newDevice.name} has been added.` });
      }
      setEditingDevice(null);
      setIsFormOpen(false);
      setIsLoading(false);
    }, 500);
  };

  const handleDeleteDevice = (deviceId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setDevices(devices.filter(d => d.id !== deviceId));
      toast({ title: "Device Deleted", description: `Device ID ${deviceId} has been deleted.`, variant: 'destructive' });
      setIsLoading(false);
    }, 500);
  };

  const openAddForm = () => {
    setEditingDevice(null);
    setIsFormOpen(true);
  };

  const openEditForm = (device: Device) => {
    setEditingDevice(device);
    setIsFormOpen(true);
  };

  if (isLoading && devices.length === 0) { // Show skeleton only on initial load
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Manage Devices</h2>
        <ItemFormDialog
            itemType="device"
            itemData={editingDevice}
            onSave={handleSaveDevice}
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            triggerButton={
              <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Device
              </Button>
            }
          />
      </div>
      {isLoading && devices.length > 0 && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
      <ItemManagementTable
        items={devices}
        itemType="device"
        onEdit={openEditForm}
        onDelete={handleDeleteDevice}
      />
    </div>
  );
}
