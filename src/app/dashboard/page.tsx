"use client";

import ReservationsTable from '@/components/reservations/ReservationsTable';
import { useAuth } from '@/hooks/useAuth';
import type { Reservation } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addHours, subDays, addDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Mock Data
const generateMockReservations = (userId: string): Reservation[] => [
  { id: 'res1', userId, itemId: 'laptop1', itemName: 'Dell XPS 15', itemType: 'device', startTime: subDays(new Date(), 2), endTime: addHours(subDays(new Date(), 2), 2), status: 'completed', userName: 'Test User' },
  { id: 'res2', userId, itemId: 'roomA', itemName: 'Conference Room A', itemType: 'room', startTime: addDays(new Date(), 1), endTime: addHours(addDays(new Date(), 1), 3), status: 'approved', userName: 'Test User' },
  { id: 'res3', userId, itemId: 'tablet1', itemName: 'iPad Pro', itemType: 'device', startTime: addDays(new Date(), 5), endTime: addHours(addDays(new Date(), 5), 1), status: 'pending', userName: 'Test User' },
];

export default function MyReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      // Simulate API call
      setTimeout(() => {
        setReservations(generateMockReservations(user.uid));
        setIsLoading(false);
      }, 1000);
    } else if (!authLoading) {
      setIsLoading(false); // Not logged in, no reservations to load
    }
  }, [user, authLoading]);

  const handleCancelReservation = (reservationId: string) => {
    // Simulate API call
    setIsLoading(true);
    setTimeout(() => {
      setReservations(prev => prev.map(r => r.id === reservationId ? {...r, status: 'cancelled'} : r));
      toast({
        title: "Reservation Cancelled",
        description: `Reservation ID ${reservationId} has been cancelled.`,
      });
      setIsLoading(false);
    }, 500);
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
      <h2 className="text-2xl font-semibold font-headline">My Reservations</h2>
      <ReservationsTable 
        reservations={reservations} 
        onCancel={handleCancelReservation}
      />
    </div>
  );
}
