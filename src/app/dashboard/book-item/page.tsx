
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import WeeklyBookingCalendar from '@/components/reservations/WeeklyBookingCalendar';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { getRooms as fetchRoomsFromDB, getReservations as fetchReservationsFromDB, addReservation } from '@/services/firestoreService';
import { Loader2 } from 'lucide-react';


const TIME_PERIODS: TimePeriod[] = [
  { name: '1st Period', label: '09:00 - 09:45', start: '09:00', end: '09:45' },
  { name: '2nd Period', label: '09:50 - 10:35', start: '09:50', end: '10:35' },
  { name: '3rd Period', label: '10:55 - 11:40', start: '10:55', end: '11:40' },
  { name: '4th Period (Lower)', label: '11:45 - 12:30', start: '11:45', end: '12:30' },
  { name: '4th Period (Upper)', label: '12:35 - 13:20', start: '12:35', end: '13:20' },
  { name: '5th Period', label: '13:25 - 14:10', start: '13:25', end: '14:10' },
  { name: '6th Period', label: '14:15 - 15:00', start: '14:15', end: '15:00' },
];

export default function BookItemPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false); // For individual slot booking

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRooms, fetchedReservations] = await Promise.all([
        fetchRoomsFromDB(),
        fetchReservationsFromDB() 
      ]);
      const bookableRooms = fetchedRooms.filter(room => room.status === 'available');
      setRooms(bookableRooms); 
      setReservations(fetchedReservations);
    } catch (error) {
      console.error("Error fetching data for booking page:", error);
      toast({ title: "Error", description: "Could not load rooms or reservations.", variant: "destructive" });
      setRooms([]); 
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) { 
        fetchData();
    }
  }, [authLoading, fetchData]);

  const handleBookSlot = async (bookingDetails: {
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
  }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to book.", variant: "destructive" });
      throw new Error("User not logged in"); 
    }
    setIsBooking(true);
    const newReservationData: Omit<Reservation, 'id'> = {
      userId: user.uid,
      userName: user.displayName || user.email || "User",
      userEmail: user.email || undefined,
      itemId: bookingDetails.roomId,
      itemName: bookingDetails.roomName,
      itemType: 'room', 
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      status: 'approved', 
      purpose: bookingDetails.purpose,
      bookedBy: user.displayName || user.email || "User",
    };

    try {
      const addedReservation = await addReservation(newReservationData);
      setReservations(prev => [...prev, addedReservation]); 
      toast({
        title: 'Room Booked!',
        description: `${bookingDetails.roomName} booked for ${format(bookingDetails.startTime, "MMM d, HH:mm")} - ${format(bookingDetails.endTime, "HH:mm")}. Purpose: ${bookingDetails.purpose}`,
      });
    } catch (error) {
       console.error("Error creating reservation:", error);
       toast({ title: "Booking Failed", description: "Could not create reservation. Please try again.", variant: "destructive"});
       throw error; 
    } finally {
        setIsBooking(false);
    }
  };
  
  if (authLoading || isLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/4 mb-4" />
          <Skeleton className="h-12 w-1/3 mb-2" />
          <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Book a Room by Period</h2>
        {isBooking && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>
      
      {(!isLoading && rooms.length === 0) ? (
         <p className="text-muted-foreground text-center mt-6">
            No rooms currently available for booking. Please contact an administrator if you believe this is an error.
        </p>
      ) : (
        <WeeklyBookingCalendar 
          rooms={rooms}
          reservations={reservations}
          onBookSlot={handleBookSlot}
          periods={TIME_PERIODS}
          isBookingGlobal={isBooking}
        />
      )}
    </div>
  );
}

