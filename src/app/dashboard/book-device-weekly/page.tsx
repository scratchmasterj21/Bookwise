
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import WeeklyBookingCalendar from '@/components/reservations/WeeklyBookingCalendar'; 
import type { Device, Reservation } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { getDevices as fetchDevicesFromDB, getReservations as fetchReservationsFromDB, addReservation, updateReservation, deleteReservation as deleteReservationFromDB } from '@/services/firestoreService';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TIME_PERIODS } from '@/lib/constants';

export default function BookDeviceWeeklyPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedDevices, fetchedReservations] = await Promise.all([
        fetchDevicesFromDB(), 
        fetchReservationsFromDB() 
      ]);
      
      const bookableDevices = fetchedDevices.filter(device => device.status === 'available' && device.quantity > 0);
      setDevices(bookableDevices); 
      setReservations(fetchedReservations.filter(r => r.itemType === 'device'));
    } catch (error) {
      console.error("Error fetching data for device booking page:", error);
      toast({ title: "Error", description: "Could not load devices or reservations.", variant: "destructive" });
      setDevices([]); 
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
    devicePurposes?: string[]; 
    notes?: string; 
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
      bookedBy: user.displayName || user.email || "User",
    };

    try {
      const addedReservation = await addReservation(newReservationData);
      setReservations(prev => [...prev, addedReservation]); 
      toast({
        title: 'Device Booked!',
        description: `${bookingDetails.itemName} booked for ${format(bookingDetails.startTime, "MMM d, HH:mm")} - ${format(bookingDetails.endTime, "HH:mm")}.`,
      });
    } catch (error) {
       console.error("Error creating device reservation:", error);
       toast({ title: "Booking Failed", description: "Could not create device reservation. Please try again.", variant: "destructive"});
       throw error; 
    } finally {
        setIsProcessingGlobal(false);
    }
  };

  const handleUpdateSlot = async (reservationId: string, newDetails: { devicePurposes?: string[], notes?: string }) => { 
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to update bookings.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    setIsProcessingGlobal(true);
    try {
      await updateReservation(reservationId, newDetails); 
      setReservations(prev => 
        prev.map(res => res.id === reservationId ? { ...res, ...newDetails } : res)
      );
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
  
  if (authLoading || isLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-12 w-1/3 mb-2" />
          <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Book a Device by Period (Weekly)</h2>
        {isProcessingGlobal && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>
      
      {(!isLoading && devices.length === 0) ? (
         <p className="text-muted-foreground text-center mt-6">
            No devices currently available for booking by period.
        </p>
      ) : (
        <WeeklyBookingCalendar 
          items={devices} 
          itemType="device" 
          reservations={reservations}
          onBookSlot={handleBookSlot as any} 
          onUpdateSlot={handleUpdateSlot as any}
          onDeleteSlot={handleDeleteSlot}
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
