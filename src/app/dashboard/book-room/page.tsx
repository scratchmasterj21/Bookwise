"use client";

import React, { useState, useEffect } from 'react';
import ReservationCalendar from '@/components/reservations/ReservationCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Room, ReservationRequest } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import Image from 'next/image';
import { DoorOpen, Users, Building, CalendarCheck2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const mockRooms: Room[] = [
  { id: 'roomA', name: 'Conference Room A', capacity: 10, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Large room with AV equipment.', amenities: ['Projector', 'Whiteboard', 'Video Conferencing'] },
  { id: 'roomB', name: 'Meeting Room B', capacity: 4, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Small, quiet room for focused meetings.', amenities: ['Whiteboard'] },
  { id: 'roomC', name: 'Huddle Space C', capacity: 2, status: 'booked', imageUrl: 'https://placehold.co/600x400.png', description: 'Compact space for quick discussions.', amenities: [] },
];

export default function BookRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    // Simulate fetching rooms
    setIsLoading(true);
    setTimeout(() => {
      setAvailableRooms(mockRooms.filter(r => r.status === 'available'));
      setIsLoading(false);
    }, 500);
  }, []);

  const handleBookRoom = async () => {
    if (!user || !selectedRoom || !selectedDateRange?.from || !selectedDateRange?.to) {
      toast({
        title: 'Missing Information',
        description: 'Please select a room and a valid date range.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsBooking(true);
    // Simulate API call for booking
    const reservationData: ReservationRequest = {
      itemId: selectedRoom.id,
      itemName: selectedRoom.name,
      itemType: 'room',
      startTime: selectedDateRange.from,
      endTime: selectedDateRange.to,
    };

    console.log('Booking room:', reservationData);

    setTimeout(() => {
      toast({
        title: 'Room Booked!',
        description: `${selectedRoom.name} has been booked from ${selectedDateRange.from?.toLocaleDateString()} to ${selectedDateRange.to?.toLocaleDateString()}.`,
      });
      setSelectedRoom(null);
      setSelectedDateRange(undefined);
      setIsBooking(false);
    }, 1500);
  };

  if (authLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold font-headline">Book a Room</h2>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <ReservationCalendar 
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            // bookedDates={mockBookedDatesForRoom} // Dynamic based on selected room
          />
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Select Room</CardTitle>
            <CardDescription>Choose an available room for your selected dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
               <Skeleton className="h-10 w-full" />
            ) : (
            <div className="space-y-2">
              <Label htmlFor="room-select">Available Rooms</Label>
              <Select
                onValueChange={(roomId) => {
                  const room = availableRooms.find(r => r.id === roomId);
                  setSelectedRoom(room || null);
                }}
                value={selectedRoom?.id || ""}
              >
                <SelectTrigger id="room-select" className="w-full">
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      <div className="flex items-center gap-2">
                        <DoorOpen className="h-5 w-5 text-primary" />
                        <span>{room.name} (Capacity: {room.capacity})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {selectedRoom && (
              <Card className="mt-4 bg-muted/50 p-4 animate-subtle-fade-in">
                 <CardHeader className="p-0 pb-2">
                    <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{selectedRoom.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 text-sm space-y-2">
                  {selectedRoom.imageUrl && (
                     <div className="my-2 rounded-md overflow-hidden aspect-video relative w-full max-w-xs mx-auto">
                        <Image src={selectedRoom.imageUrl} alt={selectedRoom.name} layout="fill" objectFit="cover" data-ai-hint="meeting room" />
                     </div>
                   )}
                  <p className="text-muted-foreground">{selectedRoom.description}</p>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" /> 
                    <span>Capacity: {selectedRoom.capacity} people</span>
                  </div>
                  {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground">Amenities:</h4>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {selectedRoom.amenities.map(amenity => <li key={amenity}>{amenity}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleBookRoom} 
              disabled={!selectedRoom || !selectedDateRange?.from || !selectedDateRange?.to || isBooking || isLoading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isBooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck2 className="mr-2 h-4 w-4" />
              )}
              Book Room
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
