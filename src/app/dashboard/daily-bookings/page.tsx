
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import DailyBookingTable from '@/components/reservations/DailyBookingTable';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { getRooms as fetchRoomsFromDB, getReservations as fetchReservationsFromDB, addReservation, updateReservationPurpose, deleteReservation as deleteReservationFromDB } from '@/services/firestoreService';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TIME_PERIODS } from '@/lib/constants';

export default function DailyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(Date.now()); // Key to reset DailyBookingTable

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
      console.error("Error fetching data for daily booking page:", error);
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
    itemId: string; 
    itemName: string; 
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

  const handleDeleteSlotRequest = (reservationId: string) => {
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

  const handleConfirmMultiBookRoomDaily = async (details: {
    itemId: string;
    itemName: string;
    periods: TimePeriod[];
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

    for (const period of details.periods) {
      const startTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
      const endTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);
      
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
    
    setTableKey(Date.now()); 
    setIsProcessingGlobal(false);
  };
  
  if (authLoading || (isLoading && rooms.length === 0)) {
     return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
            <Skeleton className="h-10 w-full sm:w-1/3" />
            <Skeleton className="h-10 w-full sm:w-48" />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-semibold font-headline">Daily Room Bookings</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isProcessingGlobal && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal shadow-sm",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={isProcessingGlobal}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                disabled={isProcessingGlobal}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {(!isLoading && rooms.length === 0) ? (
         <p className="text-muted-foreground text-center mt-6">
            No rooms currently available for booking. Please contact an administrator if you believe this is an error.
        </p>
      ) : isLoading ? (
         <Skeleton className="h-[500px] w-full" />
      ) : (
        <DailyBookingTable 
          key={tableKey}
          selectedDate={selectedDate}
          items={rooms}
          itemType="room"
          reservations={reservations}
          onBookSlot={handleBookSlot}
          onUpdateSlot={handleUpdateSlot as any} 
          onDeleteSlot={handleDeleteSlotRequest}
          onConfirmMultiBookDaily={handleConfirmMultiBookRoomDaily as any} 
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
