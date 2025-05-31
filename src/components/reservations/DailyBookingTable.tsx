
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Loader2, Trash2 } from 'lucide-react';
import {
  format,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isSameDay,
  isBefore,
  isToday,
} from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { cn } from '@/lib/utils';

interface DailyBookingTableProps {
  selectedDate: Date;
  rooms: Room[];
  reservations: Reservation[];
  onBookSlot: (bookingDetails: {
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
  }) => Promise<void>;
  onUpdateSlot: (reservationId: string, newPurpose: string) => Promise<void>;
  onDeleteSlot: (reservationId: string) => void;
  periods: TimePeriod[];
  isProcessingGlobal?: boolean;
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'past-available' | 'past-booked';
  isPast: boolean;
  displayText?: string;
  bookedBy?: string;
  purpose?: string;
  roomName?: string;
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation;
}

interface RoomStyling {
  borderClass: string;
  textClass: string;
  backgroundClass: string; // For booked slots by others
}

// Helper function to get styling based on room name (similar to WeeklyBookingCalendar)
const getRoomStyling = (roomName?: string): RoomStyling => {
    const lowerRoomName = roomName?.toLowerCase() || "";
    // Specific colors for different rooms
    if (lowerRoomName.includes('computer room')) return { borderClass: 'border-sky-400', textClass: 'text-sky-700', backgroundClass: 'bg-sky-50' };
    if (lowerRoomName.includes('multipurpose room')) return { borderClass: 'border-purple-400', textClass: 'text-purple-700', backgroundClass: 'bg-purple-50' };
    if (lowerRoomName.includes('music')) return { borderClass: 'border-orange-400', textClass: 'text-orange-700', backgroundClass: 'bg-orange-50' };
    if (lowerRoomName.includes('agape hall')) return { borderClass: 'border-emerald-400', textClass: 'text-emerald-700', backgroundClass: 'bg-emerald-50' };
    // Default styling for other rooms
    return { borderClass: 'border-amber-400', textClass: 'text-amber-700', backgroundClass: 'bg-amber-50' };
};


const getLastName = (fullName?: string): string => {
  if (!fullName) return 'User';
  const parts = fullName.split(' ');
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
};

export default function DailyBookingTable({
  selectedDate,
  rooms,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  periods,
  isProcessingGlobal = false,
}: DailyBookingTableProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [isSlotProcessing, setIsSlotProcessing] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{room: Room, period: TimePeriod, existingReservation?: Reservation} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null); // room.id + period.name

  useEffect(() => {
    if (!bookingModalOpen) {
        setEditingReservationId(null);
        setBookingPurpose('');
    }
  }, [bookingModalOpen]);

  const getReservationsForSlot = (room: Room, period: TimePeriod, targetDate: Date): Reservation | undefined => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.find(res => {
      if (res.itemId !== room.id || res.itemType !== 'room') return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return isSameDay(reservationStart, targetDate) && 
             reservationStart < periodEndDateTime && 
             reservationEnd > periodStartDateTime && 
             res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };

  const handleSlotAction = (room: Room, period: TimePeriod, actionType: 'book' | 'edit', existingReservation?: Reservation) => {
    if (isProcessingGlobal || isSlotProcessing) return;
    if (!user) {
      toast({ title: "Authentication required", description: "Please log in.", variant: "destructive" });
      return;
    }

    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPastSlot = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    if (isPastSlot && actionType === 'book') {
        toast({title: "Past Slot", description: "This slot cannot be booked."});
        return;
    }
    
    if (actionType === 'edit' && existingReservation) {
      const canManageBooking = isAdmin || existingReservation.userId === user.uid;
      if (!canManageBooking) {
        toast({ title: "Permission Denied", description: "You cannot edit this booking.", variant: "destructive"});
        return;
      }
      setCurrentBookingSlot({ room, period, existingReservation });
      setBookingPurpose(existingReservation.purpose || '');
      setEditingReservationId(existingReservation.id);
    } else if (actionType === 'book') {
      setCurrentBookingSlot({ room, period });
      setBookingPurpose('');
      setEditingReservationId(null);
    }
    setBookingModalOpen(true);
  };

  const confirmBookingOrUpdate = async () => {
    if (!currentBookingSlot || !user ) return;
    setIsSlotProcessing(true);

    const { room, period } = currentBookingSlot;
    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      if (editingReservationId) {
        await onUpdateSlot(editingReservationId, bookingPurpose.trim());
      } else {
        await onBookSlot({
            roomId: room.id,
            roomName: room.name,
            startTime,
            endTime,
            purpose: bookingPurpose.trim()
        });
      }
    } catch (error) {
      // Error toast handled by parent
    } finally {
      setIsSlotProcessing(false);
      setBookingModalOpen(false);
    }
  };
  
  const getCellDisplayData = (room: Room, period: TimePeriod): CellDisplayInfo => {
    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPast = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    const mainReservation = getReservationsForSlot(room, period, selectedDate);

    if (isPast) {
        if (mainReservation) return {
            status: 'past-booked',
            isPast: true,
            bookedBy: mainReservation.bookedBy || 'N/A',
            purpose: mainReservation.purpose || '',
            roomName: mainReservation.itemName,
            isCurrentUserBooking: mainReservation.userId === user?.uid,
            mainReservation
        };
        return { status: 'past-available', isPast: true, displayText: "" }; // Display nothing for past available
    }

    if (mainReservation) {
        const isCurrentUserBooking = mainReservation.userId === user?.uid;
        return {
            status: 'booked',
            isPast: false,
            bookedBy: mainReservation.bookedBy || 'N/A',
            purpose: mainReservation.purpose || '',
            roomName: mainReservation.itemName,
            isCurrentUserBooking,
            mainReservation
        };
    }
    return { status: 'available', isPast: false, displayText: "Available" };
  };

  const getCellClasses = (room: Room, period: TimePeriod) => {
    const cellData = getCellDisplayData(room, period);
    const roomStyling = getRoomStyling(cellData.roomName || room.name);
    let baseClasses = "p-0 border align-top h-[70px] relative text-xs group/cell";

    if (isSameDay(selectedDate, new Date()) && isToday(selectedDate)) { // Highlight cells if selectedDate is today
        // Could add further period specific highlight if needed
    }

    if (cellData.isPast) {
        if (cellData.status === 'past-booked') {
            baseClasses = cn(baseClasses, `bg-slate-100 ${roomStyling.borderClass} border-dashed opacity-60 cursor-default`);
        } else { 
            baseClasses = cn(baseClasses, "bg-slate-50 border-slate-200 border-dashed cursor-default");
        }
    } else { 
        if (cellData.status === 'booked') {
            const bgClass = cellData.isCurrentUserBooking ? 'bg-green-50' : roomStyling.backgroundClass;
            baseClasses = cn(baseClasses, `${bgClass} ${roomStyling.borderClass} border-2`, "cursor-pointer");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 cursor-pointer transition-colors duration-150");
        }
    }
    return baseClasses;
  };

  const handleCellClick = (room: Room, period: TimePeriod) => {
    const cellData = getCellDisplayData(room, period);
    if (isProcessingGlobal || isSlotProcessing) return;

    if (cellData.isPast) {
      if(cellData.mainReservation) { 
        toast({
            title: "Past Booking",
            description: `${cellData.roomName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || 'N/A'}`
        });
      } else { 
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }
    
    const canManageCurrentBooking = isAdmin || cellData.isCurrentUserBooking;

    if (cellData.mainReservation) { // Booked slot
        if (canManageCurrentBooking) {
            handleSlotAction(room, period, 'edit', cellData.mainReservation);
        } else { 
             toast({
                title: "Booking Details",
                description: `${cellData.roomName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || 'N/A'}`
            });
        }
    } else if (cellData.status === 'available') {
        handleSlotAction(room, period, 'book');
    }
  };

  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[900px]">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 border-b border-r text-center sticky left-0 bg-muted z-20 font-semibold text-foreground align-middle h-16 min-w-[150px]">Room</th>
                {periods.map(period => (
                  <th key={period.name} className={cn(
                      "p-2 border-b border-r text-center min-w-[120px] font-semibold text-foreground align-middle h-16",
                    )}>
                    {period.name} <br /> <span className="font-normal text-xs text-muted-foreground">{period.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="even:bg-background odd:bg-muted/20">
                  <td className="p-2 border-r text-left sticky left-0 z-10 align-middle h-[70px] even:bg-background odd:bg-muted/20 font-medium min-w-[150px] whitespace-nowrap">
                     {room.name}
                     <div className="text-xs text-muted-foreground">{room.buildingName}</div>
                  </td>
                  {periods.map(period => {
                    const slotKey = `${room.id}-${period.name}`;
                    const cellData = getCellDisplayData(room, period);
                    const roomStyling = getRoomStyling(cellData.roomName || room.name);
                    
                    const canManageBooking = isAdmin || cellData.isCurrentUserBooking;
                    const showActions = canManageBooking && cellData.mainReservation && !cellData.isPast && hoveredSlot === slotKey;

                    return (
                      <td
                        key={slotKey}
                        className={cn(getCellClasses(room, period))}
                        onClick={() => handleCellClick(room, period)}
                        onMouseEnter={() => setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <div className="h-full w-full flex flex-col relative p-1.5">
                          {cellData.status === 'booked' || cellData.status === 'past-booked' ? (
                             <div className={cn("flex flex-col text-left w-full h-full space-y-0.5", cellData.isPast ? "opacity-60" : "")}>
                              <div>
                                  <span className={cn("block font-semibold text-[10px] leading-tight", roomStyling.textClass)}>
                                      {cellData.roomName}
                                  </span>
                                  <span className="block font-semibold text-red-600 text-[10px] leading-tight">
                                      {getLastName(cellData.bookedBy)}
                                  </span>
                                  <span className="block text-slate-700 text-[10px] leading-tight break-words whitespace-normal mt-0.5">
                                      {cellData.purpose}
                                  </span>
                              </div>
                            </div>
                          ) : cellData.status === 'available' && !cellData.isPast ? (
                              <div className="flex-grow flex flex-col items-center justify-center">
                                  <span className="text-primary font-medium text-xs">{cellData.displayText}</span>
                              </div>
                          ) : cellData.status === 'past-available' ? (
                               <div className="flex-grow flex flex-col items-center justify-center">
                                  {/* Display nothing for past available slots */}
                              </div>
                          ) : null}

                          {showActions && (
                              <div className="absolute top-1 right-1 flex items-center space-x-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                    onClick={(e) => { e.stopPropagation(); cellData.mainReservation && handleSlotAction(room, period, 'edit', cellData.mainReservation); }}
                                    aria-label="Edit booking"
                                    disabled={isSlotProcessing || isProcessingGlobal}
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                                    onClick={(e) => { e.stopPropagation(); cellData.mainReservation && onDeleteSlot(cellData.mainReservation.id); }}
                                    aria-label="Delete booking"
                                    disabled={isSlotProcessing || isProcessingGlobal}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                              </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{editingReservationId ? "Edit Booking" : "Book Slot"}</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-3">
              <div className="text-sm space-y-1">
                <p><strong>Room:</strong> {currentBookingSlot.room.name}</p>
                <p><strong>Date:</strong> {format(selectedDate, 'EEEE, MMM dd, yyyy')}</p>
                <p><strong>Period:</strong> {currentBookingSlot.period.name} ({currentBookingSlot.period.label})</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-purpose" className="font-medium">Purpose/Class:</Label>
                <Input
                  id="booking-purpose"
                  value={bookingPurpose}
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  placeholder="e.g., Grade 5 Math Class"
                  className="text-sm"
                  disabled={isSlotProcessing || isProcessingGlobal}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSlotProcessing || isProcessingGlobal}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmBookingOrUpdate}
              disabled={isSlotProcessing || isProcessingGlobal || !bookingPurpose.trim()}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {(isSlotProcessing || isProcessingGlobal) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingReservationId ? "Update Booking" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
