
"use client";

import React, { useState, useEffect } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Room, Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Mock buildings data - should ideally be fetched or come from a shared source/context
const mockBuildings: Building[] = [
  { id: 'bldg1', name: 'Main Headquarters', location: '123 Tech Avenue', notes: 'Primary admin and operations building.' },
  { id: 'bldg2', name: 'Research & Development Wing', location: '456 Innovation Drive', notes: 'Contains labs and R&D offices.' },
];

const initialMockRooms: Room[] = [
  { id: 'room100', name: 'Admin Conf Room Alpha', capacity: 12, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Main conference room for admin team.', amenities: ['Projector', 'Large Whiteboard'], buildingId: 'bldg1', buildingName: 'Main Headquarters' },
  { id: 'room200', name: 'Admin Focus Booth', capacity: 1, status: 'maintenance', imageUrl: 'https://placehold.co/600x400.png', description: 'For private calls, currently under acoustic treatment.', amenities: [], buildingId: 'bldg1', buildingName: 'Main Headquarters' },
  { id: 'room300', name: 'R&D Lab A', capacity: 8, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Wet lab space.', amenities: ['Fume Hood', 'Microscope'], buildingId: 'bldg2', buildingName: 'Research & Development Wing' },
];

export default function ManageRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<Building[]>(mockBuildings); // Use mock buildings

  useEffect(() => {
    setIsLoading(true);
    // In a real app, fetch buildings here if not already available globally
    setTimeout(() => {
      setRooms(initialMockRooms);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveRoom = (roomData: Partial<Room>) => {
    setIsLoading(true);
    setTimeout(() => {
      const building = buildings.find(b => b.id === roomData.buildingId);
      const fullRoomData = { 
        ...roomData, 
        buildingName: building?.name || roomData.buildingName // Ensure buildingName is set
      } as Room;

      if (editingRoom) {
        setRooms(rooms.map(r => r.id === editingRoom.id ? { ...r, ...fullRoomData } : r));
        toast({ title: "Room Updated", description: `${fullRoomData.name} has been updated.` });
      } else {
        const newRoom = { ...fullRoomData, id: `room-${Date.now()}` };
        setRooms([...rooms, newRoom]);
        toast({ title: "Room Added", description: `${newRoom.name} has been added.` });
      }
      setEditingRoom(null);
      setIsFormOpen(false);
      setIsLoading(false);
    }, 500);
  };

  const handleDeleteRoom = (roomId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setRooms(rooms.filter(r => r.id !== roomId));
      toast({ title: "Room Deleted", description: `Room ID ${roomId} has been deleted.`, variant: 'destructive' });
      setIsLoading(false);
    }, 500);
  };
  
  const openAddForm = () => {
    setEditingRoom(null);
    setIsFormOpen(true);
  };

  const openEditForm = (room: Room) => {
    setEditingRoom(room);
    setIsFormOpen(true);
  };

  if (isLoading && rooms.length === 0) {
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
            buildings={buildings} // Pass buildings to the form
            triggerButton={
              <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Room
              </Button>
            }
          />
      </div>
      {isLoading && rooms.length > 0 && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
      <ItemManagementTable
        items={rooms}
        itemType="room"
        onEdit={openEditForm}
        onDelete={handleDeleteRoom}
      />
    </div>
  );
}
