"use client";

import React, { useState, useEffect } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Room } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const initialMockRooms: Room[] = [
  { id: 'room100', name: 'Admin Conf Room Alpha', capacity: 12, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Main conference room for admin team.', amenities: ['Projector', 'Large Whiteboard'] },
  { id: 'room200', name: 'Admin Focus Booth', capacity: 1, status: 'maintenance', imageUrl: 'https://placehold.co/600x400.png', description: 'For private calls, currently under acoustic treatment.', amenities: [] },
];

export default function ManageRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setRooms(initialMockRooms);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveRoom = (roomData: Partial<Room>) => {
    setIsLoading(true);
    setTimeout(() => {
      if (editingRoom) {
        setRooms(rooms.map(r => r.id === editingRoom.id ? { ...r, ...roomData } as Room : r));
        toast({ title: "Room Updated", description: `${roomData.name} has been updated.` });
      } else {
        const newRoom = { ...roomData, id: `room-${Date.now()}` } as Room;
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
