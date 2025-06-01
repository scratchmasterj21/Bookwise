
"use client";

import ReservationsTable from '@/components/reservations/ReservationsTable';
import { useAuth } from '@/hooks/useAuth';
import type { Reservation } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { listenToUserReservations, cancelReservation as cancelUserReservationFirestore } from '@/services/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';


export default function MyReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (user && !authLoading) {
      setIsLoading(true);
      unsubscribe = listenToUserReservations(user.uid, (fetchedReservations) => {
        setReservations(
          fetchedReservations.filter(r => r.status !== 'cancelled' && r.status !== 'rejected' && r.status !== 'completed')
        );
        setIsLoading(false);
      });
    } else if (!user && !authLoading) {
      setReservations([]);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, authLoading]);

  const handleCancelReservation = async (reservationId: string) => {
    setIsProcessing(true);
    try {
      await cancelUserReservationFirestore(reservationId);
      toast({
        title: "Reservation Cancelled",
        description: `Reservation ID ${reservationId} has been cancelled.`,
      });
      // Real-time listener will update the reservations state
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      toast({ title: "Error", description: "Could not cancel reservation.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading || (isLoading && user)) {
    return (
      <div>
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">My Reservations</h2>
        {isProcessing && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>
      <ReservationsTable 
        reservations={reservations} 
        onCancel={handleCancelReservation}
      />
    </div>
  );
}
