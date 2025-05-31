
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Room, Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { addRoom, getRooms, updateRoom, deleteRoom as deleteRoomFromDB, getBuildings } from '@/services/firestoreService';

export default function ManageRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRooms, fetchedBuildings] = await Promise.all([
        getRooms(),
        getBuildings()
      ]);
      setRooms(fetchedRooms);
      setBuildings(fetchedBuildings);
    } catch (error) {
      console.error("Error fetching rooms or buildings:", error);
      toast({ title: "Error", description: "Could not fetch page data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const handleSaveRoom = async (roomData: Partial<Room>) => {
    setIsProcessing(true);
    try {
      const building = buildings.find(b => b.id === roomData.buildingId);
      const fullRoomData = {
        ...roomData,
        buildingName: building?.name || roomData.buildingName
      };

      if (!fullRoomData.name || !fullRoomData.buildingId || !fullRoomData.floorNumber) {
           toast({ title: "Missing Information", description: "Room name, building, and floor number are required.", variant: "destructive"});
           setIsProcessing(false);
           return;
      }

      if (editingRoom && editingRoom.id) {
        const { id, ...updateData } = fullRoomData;
        await updateRoom(editingRoom.id, updateData as Omit<Room, 'id'>);
        toast({ title: "Room Updated", description: `${fullRoomData.name || editingRoom.name} has been updated.` });
      } else {
        const newRoomData = fullRoomData as Omit<Room, 'id'>;
        await addRoom(newRoomData);
        toast({ title: "Room Added", description: `${newRoomData.name} has been added.` });
      }
      setEditingRoom(null);
      setIsFormOpen(false);
      fetchPageData();
    } catch (error) {
      console.error("Error saving room:", error);
      toast({ title: "Error", description: "Could not save room.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setIsProcessing(true);
    try {
      await deleteRoomFromDB(roomId);
      toast({ title: "Room Deleted", description: `Room ID ${roomId} has been deleted.`, variant: "destructive" });
      fetchPageData();
    } catch (error) {
      console.error("Error deleting room:", error);
      toast({ title: "Error", description: "Could not delete room.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const openAddForm = () => {
    setEditingRoom(null);
    setIsFormOpen(true);
  };

  const openEditForm = (room: Room) => {
    setEditingRoom(room);
    setIsFormOpen(true);
  };

  if (isLoading && rooms.length === 0 && buildings.length === 0) {
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
        <h2 className="text-2xl font-semibold font-headline">Manage Rooms</h2>
         <ItemFormDialog
            itemType="room"
            itemData={editingRoom}
            onSave={handleSaveRoom}
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            buildings={buildings}
            triggerButton={
              <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || buildings.length === 0}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                 Add New Room
              </Button>
            }
          />
      </div>
      {buildings.length === 0 && !isLoading && <p className="text-center text-muted-foreground mt-4">Please add a building first before adding rooms.</p>}
      {(isLoading || isProcessing) && (rooms.length > 0 || buildings.length > 0) && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
       {!isLoading && rooms.length === 0 && buildings.length > 0 && <p className="text-center text-muted-foreground mt-4">No rooms found. Add some to the buildings!</p>}
      <ItemManagementTable
        items={rooms}
        itemType="room"
        onEdit={openEditForm}
        onDelete={handleDeleteRoom}
      />
    </div>
  );
}
