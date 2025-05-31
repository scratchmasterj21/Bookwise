
"use client";

import type { Reservation, ReservationStatus } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Edit3, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ReservationsTableProps {
  reservations: Reservation[];
  title?: string;
  isAdminView?: boolean;
  onCancel?: (reservationId: string) => void;
  onApprove?: (reservationId: string) => void;
  onReject?: (reservationId: string) => void;
}

const getStatusVariant = (status: ReservationStatus): "default" | "secondary" | "destructive" | "outline" | "success" => {
  switch (status) {
    case 'approved':
    case 'active':
      return 'success'; 
    case 'pending':
      return 'secondary';
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    case 'completed':
      return 'outline';
    default:
      return 'default';
  }
};


export default function ReservationsTable({
  reservations,
  title = "My Reservations",
  isAdminView = false,
  onCancel,
  onApprove,
  onReject,
}: ReservationsTableProps) {
  
  if (reservations.length === 0) {
    return <p className="text-muted-foreground mt-4 text-center">No reservations found.</p>;
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden animate-subtle-fade-in">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Name</TableHead>
            <TableHead>Type</TableHead>
            {isAdminView && <TableHead>User</TableHead>}
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell className="font-medium">{reservation.itemName || 'N/A'}</TableCell>
              <TableCell className="capitalize">{reservation.itemType}</TableCell>
              {isAdminView && <TableCell>{reservation.userName || reservation.userEmail || 'N/A'}</TableCell>}
              <TableCell>{format(new Date(reservation.startTime), "MMM d, yyyy HH:mm")}</TableCell>
              <TableCell>{format(new Date(reservation.endTime), "MMM d, yyyy HH:mm")}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(reservation.status)} className="capitalize">
                  {reservation.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                {isAdminView && reservation.status === 'pending' && onApprove && onReject && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => onApprove(reservation.id)} className="text-primary hover:text-primary/90 hover:bg-primary/10">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onReject(reservation.id)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {!isAdminView && (reservation.status === 'pending' || reservation.status === 'approved' || reservation.status === 'active') && onCancel && (
                  <Button variant="outline" size="sm" onClick={() => onCancel(reservation.id)} className="text-destructive border-destructive hover:bg-destructive/10">
                    <Trash2 className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
