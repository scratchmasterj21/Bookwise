
"use client";

import ReservationsTable from '@/components/reservations/ReservationsTable';
import type { Reservation } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { getReservations as fetchAllReservationsFromDB, updateReservationStatus } from '@/services/firestoreService';
import { Loader2 } from 'lucide-react';


export default function ManageReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchAllReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedReservations = await fetchAllReservationsFromDB(); 
      // Show pending first, then approved/active, then others
      const sortedReservations = fetchedReservations.sort((a, b) => {
        const statusOrder = { pending: 0, approved: 1, active: 1, completed: 2, rejected: 3, cancelled: 4 };
        return statusOrder[a.status] - statusOrder[b.status] || new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setReservations(sortedReservations); 
    } catch (error) {
      console.error("Error fetching all reservations:", error);
      toast({ title: "Error", description: "Could not fetch reservations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllReservations();
  }, [fetchAllReservations]);

  const handleApproval = async (reservationId: string, approved: boolean) => {
    setIsProcessing(true);
    try {
      const newStatus = approved ? 'approved' : 'rejected';
      await updateReservationStatus(reservationId, newStatus);
      toast({
        title: `Reservation ${approved ? 'Approved' : 'Rejected'}`,
        description: `Reservation ID ${reservationId} has been updated.`,
      });
      // Optimistically update UI or refetch
      setReservations(prev => 
        prev.map(r => r.id === reservationId ? {...r, status: newStatus} : r)
          .filter(r => !(newStatus === 'rejected' && r.id === reservationId)) // Optionally remove rejected ones immediately
      );
      // Or simply refetch: fetchAllReservations();
    } catch (error) {
      console.error("Error updating reservation status:", error);
      toast({ title: "Error", description: "Could not update reservation status.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading && reservations.length === 0) {
    return (
      <div>
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
       <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Manage All Reservations</h2>
        {(isLoading || isProcessing) && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>
      {!isLoading && reservations.length === 0 && <p className="text-center text-muted-foreground mt-4">No reservations found.</p>}
      <ReservationsTable 
        reservations={reservations} 
        isAdminView={true}
        onApprove={(id) => handleApproval(id, true)}
        onReject={(id) => handleApproval(id, false)}
      />
    </div>
  );
}
