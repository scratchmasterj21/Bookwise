"use client";

import ReservationsTable from '@/components/reservations/ReservationsTable';
import type { Reservation } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addDays, addHours, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Mock Data - expanded for admin view
const generateMockAdminReservations = (): Reservation[] => [
  { id: 'res10', userId: 'userX', userName: 'Alice Wonderland', userEmail: 'alice@example.com', itemId: 'laptop3', itemName: 'Surface Laptop', itemType: 'device', startTime: addDays(new Date(), 2), endTime: addHours(addDays(new Date(), 2), 4), status: 'pending' },
  { id: 'res11', userId: 'userY', userName: 'Bob The Builder', userEmail: 'bob@example.com', itemId: 'roomD', itemName: 'Main Auditorium', itemType: 'room', startTime: addDays(new Date(), 3), endTime: addHours(addDays(new Date(), 3), 2), status: 'pending' },
  { id: 'res12', userId: 'userZ', userName: 'Charlie Brown', userEmail: 'charlie@example.com', itemId: 'projector2', itemName: 'Optoma UHD50X', itemType: 'device', startTime: subDays(new Date(),1), endTime: addHours(subDays(new Date(),1), 1), status: 'approved' },
  { id: 'res13', userId: 'userA', userName: 'Diana Prince', userEmail: 'diana@example.com', itemId: 'roomE', itemName: 'Quiet Study E', itemType: 'room', startTime: subDays(new Date(),5), endTime: addHours(subDays(new Date(),5), 3), status: 'completed' },
];

export default function ManageReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    setTimeout(() => {
      setReservations(generateMockAdminReservations());
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleApproval = (reservationId: string, approved: boolean) => {
    setIsLoading(true);
    setTimeout(() => {
      setReservations(prev => 
        prev.map(r => r.id === reservationId ? {...r, status: approved ? 'approved' : 'rejected'} : r)
          .filter(r => !(r.id === reservationId && !approved)) // Optionally remove rejected from view or keep to show status
      );
      toast({
        title: `Reservation ${approved ? 'Approved' : 'Rejected'}`,
        description: `Reservation ID ${reservationId} has been updated.`,
      });
      setIsLoading(false);
    }, 500);
  };

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold font-headline">Manage All Reservations</h2>
      <ReservationsTable 
        reservations={reservations} 
        isAdminView={true}
        onApprove={(id) => handleApproval(id, true)}
        onReject={(id) => handleApproval(id, false)}
      />
    </div>
  );
}
