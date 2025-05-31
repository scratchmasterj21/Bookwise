
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Device, Room, Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { addDevice, getDevices, updateDevice, deleteDevice as deleteDeviceFromDB, getRooms, getBuildings } from '@/services/firestoreService';


export default function ManageDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedDevices, fetchedRooms, fetchedBuildings] = await Promise.all([
        getDevices(),
        getRooms(),
        getBuildings()
      ]);
      setDevices(fetchedDevices);
      setAllRooms(fetchedRooms);
      setBuildings(fetchedBuildings);
    } catch (error) {
      console.error("Error fetching page data:", error);
      toast({ title: "Error", description: "Could not fetch page data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const handleSaveDevice = async (deviceData: Partial<Device>) => {
    setIsProcessing(true);
    try {
      const building = buildings.find(b => b.id === deviceData.buildingId);
      const room = allRooms.find(r => r.id === deviceData.roomId);
      const fullDeviceData = { 
        ...deviceData, 
        buildingName: building?.name || deviceData.buildingName,
        roomName: room?.name || deviceData.roomName,
      };

      if (editingDevice && editingDevice.id) {
        const { id, ...updateData } = fullDeviceData;
        await updateDevice(editingDevice.id, updateData as Omit<Device, 'id'>);
        toast({ title: "Device Updated", description: `${fullDeviceData.name || editingDevice.name} has been updated.` });
      } else {
        if (!fullDeviceData.name || !fullDeviceData.type || !fullDeviceData.buildingId || !fullDeviceData.roomId) {
            toast({ title: "Missing Information", description: "Device name, type, building, and room are required.", variant: "destructive"});
            setIsProcessing(false);
            return;
        }
        const newDeviceData = fullDeviceData as Omit<Device, 'id'>;
        await addDevice(newDeviceData);
        toast({ title: "Device Added", description: `${newDeviceData.name} has been added.` });
      }
      setEditingDevice(null);
      setIsFormOpen(false);
      fetchPageData(); 
    } catch (error) {
      console.error("Error saving device:", error);
      toast({ title: "Error", description: "Could not save device.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setIsProcessing(true);
    try {
      await deleteDeviceFromDB(deviceId);
      toast({ title: "Device Deleted", description: `Device ID ${deviceId} has been deleted.`, variant: "destructive" });
      fetchPageData(); 
    } catch (error) {
      console.error("Error deleting device:", error);
      toast({ title: "Error", description: "Could not delete device.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const openAddForm = () => {
    setEditingDevice(null);
    setIsFormOpen(true);
  };

  const openEditForm = (device: Device) => {
    setEditingDevice(device);
    setIsFormOpen(true);
  };

  if (isLoading && devices.length === 0 && buildings.length === 0 && allRooms.length === 0) { 
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
              <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || buildings.length === 0 || allRooms.length === 0}>
                 {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add New Device
              </Button>
            }
          />
      </div>
       {(buildings.length === 0 || allRooms.length === 0) && !isLoading && <p className="text-center text-muted-foreground mt-4">Please add buildings and rooms first before adding devices.</p>}
      {(isLoading || isProcessing) && (devices.length > 0 || buildings.length > 0 || allRooms.length > 0) && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
      {!isLoading && devices.length === 0 && buildings.length > 0 && allRooms.length > 0 && <p className="text-center text-muted-foreground mt-4">No devices found. Add some to your rooms!</p>}
      <ItemManagementTable
        items={devices}
        itemType="device"
        onEdit={openEditForm}
        onDelete={handleDeleteDevice}
      />
    </div>
  );
}
