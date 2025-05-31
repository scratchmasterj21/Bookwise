
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import WeeklyBookingCalendar from '@/components/reservations/WeeklyBookingCalendar';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { getRooms as fetchRoomsFromDB, getReservations as fetchReservationsFromDB, addReservation, updateReservationPurpose, deleteReservation as deleteReservationFromDB } from '@/services/firestoreService';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TIME_PERIODS } from '@/lib/constants';


export default function BookRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(Date.now()); // Key to reset calendar


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRooms, fetchedReservations] = await Promise.all([
        fetchRoomsFromDB(),
        fetchReservationsFromDB() 
      ]);
      const bookableRooms = fetchedRooms.filter(room => room.status === 'available');
      setRooms(bookableRooms); 
      setReservations(fetchedReservations.filter(r => r.itemType === 'room'));
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
    itemId: string; // Changed from roomId to itemId for consistency
    itemName: string; // Changed from roomName
    startTime: Date;
    endTime: Date;
    purpose: string;
  }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to book.", variant: "destructive" });
      throw new Error("User not logged in"); 
    }
    setIsProcessingGlobal(true);
    const newReservationData: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid,
      userName: user.displayName || user.email || "User",
      userEmail: user.email || undefined,
      itemId: bookingDetails.itemId,
      itemName: bookingDetails.itemName,
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
        description: `${bookingDetails.itemName} booked for ${format(bookingDetails.startTime, "MMM d, HH:mm")} - ${format(bookingDetails.endTime, "HH:mm")}. Purpose: ${bookingDetails.purpose}`,
      });
    } catch (error) {
       console.error("Error creating reservation:", error);
       toast({ title: "Booking Failed", description: "Could not create reservation. Please try again.", variant: "destructive"});
       throw error; 
    } finally {
        setIsProcessingGlobal(false);
    }
  };

  const handleUpdateSlot = async (reservationId: string, newDetails: { purpose?: string }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to update bookings.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    setIsProcessingGlobal(true);
    try {
      if (typeof newDetails.purpose !== 'string') {
         throw new Error("Purpose must be a string for room bookings.");
      }
      await updateReservationPurpose(reservationId, newDetails.purpose);
      setReservations(prev => 
        prev.map(res => res.id === reservationId ? { ...res, purpose: newDetails.purpose } : res)
      );
      toast({
        title: 'Booking Updated!',
        description: `Booking purpose has been updated.`,
      });
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast({ title: "Update Failed", description: "Could not update booking. Please try again.", variant: "destructive"});
      throw error;
    } finally {
      setIsProcessingGlobal(false);
    }
  };

  const handleDeleteSlot = (reservationId: string) => {
    setReservationToDelete(reservationId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!reservationToDelete) return;
    setIsProcessingGlobal(true);
    try {
      await deleteReservationFromDB(reservationToDelete);
      setReservations(prev => prev.filter(res => res.id !== reservationToDelete));
      toast({ title: "Booking Deleted", description: "The reservation has been successfully deleted.", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting reservation:", error);
      toast({ title: "Delete Failed", description: "Could not delete booking. Please try again.", variant: "destructive"});
    } finally {
      setIsProcessingGlobal(false);
      setShowDeleteConfirm(false);
      setReservationToDelete(null);
    }
  };

  const handleConfirmMultiBookRoom = async (details: {
    itemId: string;
    itemName: string;
    slots: { day: Date; period: TimePeriod }[];
    purpose: string;
  }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to book.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    setIsProcessingGlobal(true);
    let successCount = 0;
    let failCount = 0;
    const newBookings: Reservation[] = [];

    for (const slot of details.slots) {
      const startTime = setMilliseconds(setSeconds(setMinutes(setHours(slot.day, parseInt(slot.period.start.split(':')[0])), parseInt(slot.period.start.split(':')[1])),0),0);
      const endTime = setMilliseconds(setSeconds(setMinutes(setHours(slot.day, parseInt(slot.period.end.split(':')[0])), parseInt(slot.period.end.split(':')[1])),0),0);
      
      const newReservationData: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        userName: user.displayName || user.email || "User",
        userEmail: user.email || undefined,
        itemId: details.itemId,
        itemName: details.itemName,
        itemType: 'room',
        startTime,
        endTime,
        status: 'approved',
        purpose: details.purpose,
        bookedBy: user.displayName || user.email || "User",
      };
      try {
        const addedReservation = await addReservation(newReservationData);
        newBookings.push(addedReservation);
        successCount++;
      } catch (error) {
        console.error(`Error booking room slot ${format(startTime, "MMM d, HH:mm")} for ${details.itemName}:`, error);
        failCount++;
      }
    }
    
    setReservations(prev => [...prev, ...newBookings]);

    if (successCount > 0) {
      toast({
        title: "Multi-Booking Processed",
        description: `${successCount} period(s) for ${details.itemName} booked successfully. ${failCount > 0 ? `${failCount} failed.` : ''}`,
      });
    } else if (failCount > 0) {
       toast({ title: "Multi-Booking Failed", description: `All ${failCount} attempted bookings failed for ${details.itemName}. Please try again.`, variant: "destructive" });
    }
    
    setCalendarKey(Date.now()); // Force re-render of calendar to reset its internal state
    setIsProcessingGlobal(false);
  };
  
  if (authLoading || isLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-12 w-full mb-2" /> {/* Adjusted for select and week controls */}
          <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Book a Room by Period (Weekly)</h2>
        {isProcessingGlobal && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>
      
      {(!isLoading && rooms.length === 0) ? (
         <p className="text-muted-foreground text-center mt-6">
            No rooms currently available for booking. Please contact an administrator if you believe this is an error.
        </p>
      ) : (
        <WeeklyBookingCalendar 
          key={calendarKey}
          items={rooms}
          itemType="room"
          reservations={reservations}
          onBookSlot={handleBookSlot}
          onUpdateSlot={handleUpdateSlot as any} // Cast to allow purpose string
          onDeleteSlot={handleDeleteSlot}
          onConfirmMultiBook={handleConfirmMultiBookRoom as any} // Cast to allow room multi-book structure
          periods={TIME_PERIODS}
          isProcessingGlobal={isProcessingGlobal}
          itemDisplayName="Room"
          bookingModalPurposeLabel="Purpose of Booking"
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isProcessingGlobal}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isProcessingGlobal}>
              {isProcessingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

