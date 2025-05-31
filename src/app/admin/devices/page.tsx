
"use client";

import React, { useState, useEffect } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Device, Room, Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data - should ideally be fetched or come from a shared source/context
const mockBuildings: Building[] = [
  { id: 'bldg1', name: 'Main Headquarters', location: '123 Tech Avenue' },
  { id: 'bldg2', name: 'Research & Development Wing', location: '456 Innovation Drive' },
];

const mockRooms: Room[] = [
  { id: 'room100', name: 'Admin Conf Room Alpha', capacity: 12, status: 'available', buildingId: 'bldg1', buildingName: 'Main Headquarters' },
  { id: 'room200', name: 'Admin Focus Booth', capacity: 1, status: 'maintenance', buildingId: 'bldg1', buildingName: 'Main Headquarters' },
  { id: 'room300', name: 'R&D Lab A', capacity: 8, status: 'available', buildingId: 'bldg2', buildingName: 'Research & Development Wing' },
  { id: 'room301', name: 'R&D Lab B', capacity: 4, status: 'available', buildingId: 'bldg2', buildingName: 'Research & Development Wing' },
];

const initialMockDevices: Device[] = [
  { id: 'laptop100', name: 'Admin MacBook Pro 16"', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'For admin use.', buildingId: 'bldg1', buildingName: 'Main Headquarters', roomId: 'room100', roomName: 'Admin Conf Room Alpha' },
  { id: 'tablet200', name: 'Admin Galaxy Tab S9', type: 'Tablet', status: 'maintenance', imageUrl: 'https://placehold.co/600x400.png', description: 'Undergoing software update.', buildingId: 'bldg1', buildingName: 'Main Headquarters', roomId: 'room200', roomName: 'Admin Focus Booth'},
  { id: 'monitor300', name: 'Dev Dell 27" 4K', type: 'Monitor', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'For R&D Team.', buildingId: 'bldg2', buildingName: 'Research & Development Wing', roomId: 'room300', roomName: 'R&D Lab A'},
];

export default function ManageDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<Building[]>(mockBuildings);
  const [allRooms, setAllRooms] = useState<Room[]>(mockRooms);


  useEffect(() => {
    setIsLoading(true);
    // In a real app, fetch buildings and rooms here if not already available globally
    setTimeout(() => {
      setDevices(initialMockDevices);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveDevice = (deviceData: Partial<Device>) => {
    setIsLoading(true);
    setTimeout(() => {
      const building = buildings.find(b => b.id === deviceData.buildingId);
      const room = allRooms.find(r => r.id === deviceData.roomId);
      const fullDeviceData = { 
        ...deviceData, 
        buildingName: building?.name || deviceData.buildingName,
        roomName: room?.name || deviceData.roomName,
      } as Device;

      if (editingDevice) {
        setDevices(devices.map(d => d.id === editingDevice.id ? { ...d, ...fullDeviceData } : d));
        toast({ title: "Device Updated", description: `${fullDeviceData.name} has been updated.` });
      } else {
        const newDevice = { ...fullDeviceData, id: `device-${Date.now()}` };
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

  if (isLoading && devices.length === 0) { 
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
            buildings={buildings}
            allRooms={allRooms}
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
