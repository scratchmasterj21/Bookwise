
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import DailyBookingTable from '@/components/reservations/DailyBookingTable';
import type { Device, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { getDevices as fetchDevicesFromDB, addReservation, updateReservation, deleteReservation as deleteReservationFromDB, listenToReservationsByType } from '@/services/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TIME_PERIODS } from '@/lib/constants';

export default function BookDeviceDailyPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [devices, setDevices] = useState<Device[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(Date.now()); 

  useEffect(() => {
    let reservationUnsubscribe: Unsubscribe | undefined;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const fetchedDevices = await fetchDevicesFromDB();
        const bookableDevices = fetchedDevices.filter(device => device.status === 'available' && device.quantity > 0);
        setDevices(bookableDevices);
        
        reservationUnsubscribe = listenToReservationsByType('device', (fetchedReservations) => {
          setReservations(fetchedReservations);
          setIsLoading(false);
        });

      } catch (error) {
        console.error("Error fetching initial data for daily device booking page:", error);
        toast({ title: "Error", description: "Could not load devices or reservations.", variant: "destructive" });
        setDevices([]);
        setReservations([]);
        setIsLoading(false);
      }
    };

    if (!authLoading) {
        fetchData();
    }

    return () => {
      if (reservationUnsubscribe) {
        reservationUnsubscribe();
      }
    };
  }, [authLoading, toast]);


  const handleBookSlot = async (bookingDetails: {
    itemId: string;
    itemName: string;
    startTime: Date;
    endTime: Date;
    devicePurposes?: string[];
    notes?: string;
    bookedQuantity?: number; 
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
      itemType: 'device',
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      status: 'approved',
      devicePurposes: bookingDetails.devicePurposes,
      notes: bookingDetails.notes,
      bookedQuantity: bookingDetails.bookedQuantity || 1, 
      bookedBy: user.displayName || user.email || "User",
    };

    try {
      await addReservation(newReservationData);
      // Listener will update UI
      toast({
        title: 'Device Booked!',
        description: `${bookingDetails.itemName} (Qty: ${newReservationData.bookedQuantity}) booked for ${format(bookingDetails.startTime, "MMM d, HH:mm")} - ${format(bookingDetails.endTime, "HH:mm")}.`,
      });
    } catch (error) {
       console.error("Error creating device reservation:", error);
       toast({ title: "Booking Failed", description: "Could not create device reservation. Please try again.", variant: "destructive"});
       throw error;
    } finally {
        setIsProcessingGlobal(false);
    }
  };

  const handleUpdateSlot = async (reservationId: string, newDetails: { devicePurposes?: string[], notes?: string, bookedQuantity?: number }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to update bookings.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    setIsProcessingGlobal(true);
    try {
      await updateReservation(reservationId, newDetails);
      // Listener will update UI
      toast({
        title: 'Booking Updated!',
        description: `Booking details have been updated.`,
      });
    } catch (error) {
      console.error("Error updating device reservation:", error);
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
      // Listener will update UI
      toast({ title: "Device Booking Deleted", description: "The reservation has been successfully deleted.", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting device reservation:", error);
      toast({ title: "Delete Failed", description: "Could not delete booking. Please try again.", variant: "destructive"});
    } finally {
      setIsProcessingGlobal(false);
      setShowDeleteConfirm(false);
      setReservationToDelete(null);
    }
  };

  const handleConfirmMultiBookDeviceDaily = async (details: {
    deviceId: string;
    deviceName: string;
    periods: TimePeriod[];
    quantity: number;
    devicePurposes: string[];
    notes: string;
  }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to book.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    setIsProcessingGlobal(true);
    let successCount = 0;
    let failCount = 0;

    for (const period of details.periods) {
      const startTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
      const endTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);
      
      const newReservationData: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        userName: user.displayName || user.email || "User",
        userEmail: user.email || undefined,
        itemId: details.deviceId,
        itemName: details.deviceName,
        itemType: 'device',
        startTime,
        endTime,
        status: 'approved',
        devicePurposes: details.devicePurposes,
        notes: details.notes,
        bookedQuantity: details.quantity,
        bookedBy: user.displayName || user.email || "User",
      };
      try {
        await addReservation(newReservationData);
        successCount++;
      } catch (error) {
        console.error(`Error booking slot ${format(startTime, "MMM d, HH:mm")} for ${details.deviceName}:`, error);
        failCount++;
      }
    }
    
    // Listener will update UI

    if (successCount > 0) {
      toast({
        title: "Multi-Booking Processed",
        description: `${successCount} period(s) for ${details.deviceName} booked successfully. ${failCount > 0 ? `${failCount} failed.` : ''}`,
      });
    } else if (failCount > 0) {
       toast({ title: "Multi-Booking Failed", description: `All ${failCount} attempted bookings failed for ${details.deviceName}. Please try again.`, variant: "destructive" });
    }
    
    setTableKey(Date.now()); 
    setIsProcessingGlobal(false);
  };


  if (authLoading || (isLoading && devices.length === 0 && reservations.length === 0)) {
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
        <h2 className="text-2xl font-semibold font-headline">Daily Device Bookings</h2>
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

      {(!isLoading && devices.length === 0) ? (
         <p className="text-muted-foreground text-center mt-6">
            No devices currently available for booking.
        </p>
      ) : isLoading && reservations.length === 0 ? (
         <Skeleton className="h-[500px] w-full" />
      ) : (
        <DailyBookingTable
          key={tableKey}
          selectedDate={selectedDate}
          items={devices}
          itemType="device"
          reservations={reservations}
          onBookSlot={handleBookSlot as any}
          onUpdateSlot={handleUpdateSlot as any}
          onDeleteSlot={handleDeleteSlotRequest}
          onConfirmMultiBookDaily={handleConfirmMultiBookDeviceDaily}
          periods={TIME_PERIODS}
          isProcessingGlobal={isProcessingGlobal}
          itemDisplayName="Device"
          bookingModalPurposeLabel="Additional Notes (optional)"
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this device booking.
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
