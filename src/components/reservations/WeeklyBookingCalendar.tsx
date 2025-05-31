
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, CalendarX, CheckCircle } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
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

const ALL_ROOMS_ID = "---all---";

interface WeeklyBookingCalendarProps {
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
  periods: TimePeriod[];
  initialDate?: Date;
  isProcessingGlobal?: boolean;
}

interface CellDisplayInfo {
  status: string; // e.g., 'available', 'booked-by-me', 'past-booked', 'all-booked'
  isPast: boolean;
  displayText?: string; // For 'Available', 'Past', 'All Booked', 'X/Y Booked'
  bookedBy?: string;
  purpose?: string;
  roomName?: string; // For color coding the specific booked room
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation; // The primary reservation in the slot for single room view
}

const getRoomColorClasses = (roomName?: string, isCurrentUserBooking?: boolean, isPast?: boolean): string => {
  const hoverClass = isPast ? '' : 'hover:opacity-80'; // No hover change for past

  if (isPast) {
    if (roomName?.toLowerCase().includes('computer room')) return `bg-sky-50 text-sky-500 border-sky-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('multipurpose room')) return `bg-purple-50 text-purple-500 border-purple-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('music')) return `bg-orange-50 text-orange-500 border-orange-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('agape hall')) return `bg-emerald-50 text-emerald-500 border-emerald-200 ${hoverClass}`;
    return `bg-slate-100 text-slate-400 border-slate-200 ${hoverClass}`; // Default past booked
  }

  if (roomName?.toLowerCase().includes('computer room')) return `bg-sky-100 text-sky-700 border-sky-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('multipurpose room')) return `bg-purple-100 text-purple-700 border-purple-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('music')) return `bg-orange-100 text-orange-700 border-orange-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('agape hall')) return `bg-emerald-100 text-emerald-700 border-emerald-300 ${hoverClass}`;
  
  if (isCurrentUserBooking) return `bg-primary/10 text-primary-dark border-primary/30 ${hoverClass}`;
  return `bg-amber-100 text-amber-700 border-amber-300 ${hoverClass}`; // Default for other's booking if no specific room color
};


export default function WeeklyBookingCalendar({
  rooms,
  reservations,
  onBookSlot,
  onUpdateSlot,
  periods,
  initialDate = new Date(),
  isProcessingGlobal = false,
}: WeeklyBookingCalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }));
  const [selectedRoomId, setSelectedRoomId] = useState<string>(ALL_ROOMS_ID);

  const [isSlotProcessing, setIsSlotProcessing] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod, room?: Room | null, existingReservation?: Reservation} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [modalSelectedRoomIdForBooking, setModalSelectedRoomIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingModalOpen) {
        setModalSelectedRoomIdForBooking(undefined);
        setEditingReservationId(null);
        setBookingPurpose('');
    }
  }, [bookingModalOpen]);


  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i));
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getReservationsForSlot = (day: Date, period: TimePeriod, roomId?: string): Reservation[] => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.filter(res => {
      if (roomId && res.itemId !== roomId) return false;
      if (res.itemType !== 'room') return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };

  const handleSlotClick = (day: Date, period: TimePeriod) => {
    const slotStartDateTime = setHours(day, parseInt(period.start.split(':')[0]));
    const isPastSlot = isBefore(slotStartDateTime, new Date()) && !isSameDay(slotStartDateTime, new Date());

    if (isProcessingGlobal || isSlotProcessing) return;

    if (!user) {
      toast({ title: "Authentication required", description: "Please log in to book or edit.", variant: "destructive" });
      return;
    }

    const isAllRoomsView = selectedRoomId === ALL_ROOMS_ID;
    let targetRoom: Room | null = rooms.find(r => r.id === selectedRoomId) || null;
    let existingResForSlot: Reservation | undefined = undefined;

    if (targetRoom) { // Specific room view
        existingResForSlot = getReservationsForSlot(day, period, targetRoom.id)[0];
    }

    if (isPastSlot) {
        if (existingResForSlot && targetRoom) { // Past booked slot in specific view
            toast({ title: "Past Booking",
                    description: `${existingResForSlot.itemName} booked by ${existingResForSlot.bookedBy || 'N/A'}. Purpose: ${existingResForSlot.purpose || 'N/A'}.`,
                    duration: 5000
                  });
        } else { // Past empty slot or "All Rooms" view past slot
            toast({ title: "Past Slot", description: "This slot is in the past and cannot be booked or modified.", variant: "default"});
        }
        return;
    }

    // Current or Future Slot Logic
    if (existingResForSlot && targetRoom) { // Edit existing booking in specific room view
        setCurrentBookingSlot({ day, period, room: targetRoom, existingReservation: existingResForSlot });
        setBookingPurpose(existingResForSlot.purpose || '');
        setEditingReservationId(existingResForSlot.id);
        setModalSelectedRoomIdForBooking(existingResForSlot.itemId); // Ensure room is "selected" for modal consistency
        setBookingModalOpen(true);
    } else if (!existingResForSlot) { // New booking
        if (isAllRoomsView) {
            const availableRoomsForSlot = rooms.filter(r => getReservationsForSlot(day, period, r.id).length === 0);
            if (availableRoomsForSlot.length === 0 && rooms.length > 0) {
                toast({ title: "No Rooms Available", description: "All rooms are booked for this slot.", variant: "default" });
                return;
            }
            setCurrentBookingSlot({ day, period, room: null });
            setModalSelectedRoomIdForBooking(undefined); // User must select in modal
        } else if (targetRoom) { // New booking in specific room view
            setCurrentBookingSlot({ day, period, room: targetRoom });
            setModalSelectedRoomIdForBooking(targetRoom.id); // Pre-select for modal
        } else {
            // Should not happen if a room is selected or it's all_rooms_id
            toast({ title: "Error", description: "Cannot determine booking context.", variant: "destructive" });
            return;
        }
        setBookingPurpose('');
        setEditingReservationId(null);
        setBookingModalOpen(true);
    }
  };

  const confirmBookingOrUpdate = async () => {
    if (!currentBookingSlot || !user ) return;

    setIsSlotProcessing(true);
    const { day, period } = currentBookingSlot;

    let finalRoomId = editingReservationId ? currentBookingSlot.existingReservation?.itemId : modalSelectedRoomIdForBooking;

    if (!finalRoomId && selectedRoomId === ALL_ROOMS_ID) { // Check for "All Rooms" new booking
        toast({title: "Room Selection Required", description: "Please select a room from the dropdown.", variant: "destructive"});
        setIsSlotProcessing(false);
        return;
    }
    if(!finalRoomId && selectedRoomId !== ALL_ROOMS_ID) { // Should be pre-filled if specific room was selected
        finalRoomId = selectedRoomId;
    }


    const roomToBookOrUpdate = rooms.find(r => r.id === finalRoomId);

    if (!roomToBookOrUpdate) {
        toast({title: "Error", description: "Selected room not found.", variant: "destructive"})
        setIsSlotProcessing(false);
        setBookingModalOpen(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      if (editingReservationId) {
        await onUpdateSlot(editingReservationId, bookingPurpose.trim());
      } else {
        await onBookSlot({
            roomId: roomToBookOrUpdate.id,
            roomName: roomToBookOrUpdate.name,
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
      // setCurrentBookingSlot(null); // Resetting is handled by useEffect on bookingModalOpen
    }
  }

  const getCellDisplayData = (day: Date, period: TimePeriod): CellDisplayInfo => {
    const slotStartDateTime = setHours(day, parseInt(period.start.split(':')[0]));
    const isPast = isBefore(slotStartDateTime, new Date()) && !isSameDay(slotStartDateTime, new Date());

    if (selectedRoomId === ALL_ROOMS_ID) {
        const allSlotReservations = getReservationsForSlot(day, period);
        const bookedRoomCount = new Set(allSlotReservations.map(res => res.itemId)).size;

        if (isPast) {
            if (bookedRoomCount > 0) return { status: 'past-booked-all-view', isPast: true, displayText: `${bookedRoomCount} Room(s) Booked` };
            return { status: 'past-available', isPast: true, displayText: "Past" };
        }
        if (rooms.length > 0 && bookedRoomCount === rooms.length) {
            return { status: 'all-booked', isPast: false, displayText: "All Rooms Booked" };
        }
        if (bookedRoomCount > 0) {
             return { status: 'partially-booked', isPast: false, displayText: `${bookedRoomCount}/${rooms.length} Room(s) Booked` };
        }
        return { status: 'available', isPast: false, displayText: "Available" };
    }

    // Specific room view
    const reservationsInSlot = getReservationsForSlot(day, period, selectedRoomId);
    const mainReservation = reservationsInSlot[0];
    const roomForSlot = rooms.find(r => r.id === selectedRoomId);

    if (isPast) {
        if (mainReservation) return {
            status: 'past-booked-specific-view',
            isPast: true,
            bookedBy: mainReservation.bookedBy || 'N/A',
            purpose: mainReservation.purpose || 'No purpose',
            roomName: mainReservation.itemName,
            isCurrentUserBooking: mainReservation.userId === user?.uid,
            mainReservation
        };
        return { status: 'past-available', isPast: true, displayText: "Past", roomName: roomForSlot?.name };
    }

    if (mainReservation) {
        const isCurrentUserBooking = mainReservation.userId === user?.uid;
        return {
            status: isCurrentUserBooking ? 'booked-by-me' : 'booked-by-other',
            isPast: false,
            bookedBy: mainReservation.bookedBy || 'N/A',
            purpose: mainReservation.purpose || 'No purpose',
            roomName: mainReservation.itemName,
            isCurrentUserBooking,
            mainReservation
        };
    }
    return { status: 'available', isPast: false, displayText: "Available", roomName: roomForSlot?.name };
  };

  const getCellClasses = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    const slotDateTime = setHours(day, parseInt(period.start.split(':')[0]));
    const isPastSlotTime = isBefore(setMinutes(slotDateTime, parseInt(period.end.split(':')[1])), new Date());

    let baseClasses = "p-1 border align-top h-28 relative transition-colors duration-150 ease-in-out text-xs";

    if (cellData.isPast || (isSameDay(day, new Date()) && isPastSlotTime)) {
      if (cellData.status === 'past-booked-specific-view' || cellData.status === 'past-booked-all-view') {
         baseClasses = cn(baseClasses, getRoomColorClasses(cellData.roomName, cellData.isCurrentUserBooking, true), "cursor-pointer"); // Allow click for info toast
      } else {
         baseClasses = cn(baseClasses, "bg-slate-50 text-slate-400 cursor-not-allowed");
      }
    } else { // Current or Future
      switch (cellData.status) {
        case 'available':
          baseClasses += " bg-green-50 hover:bg-green-100 text-green-700 cursor-pointer";
          break;
        case 'booked-by-me':
        case 'booked-by-other':
          baseClasses = cn(baseClasses, getRoomColorClasses(cellData.roomName, cellData.isCurrentUserBooking, false), "cursor-pointer");
          break;
        case 'all-booked':
          baseClasses += " bg-red-100 text-red-700 cursor-not-allowed";
          break;
        case 'partially-booked': // All rooms view
          baseClasses += " bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer";
          break;
        default:
          baseClasses += " bg-card hover:bg-muted";
      }
    }
    return baseClasses;
  };

  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 pb-4 pt-4 px-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={isProcessingGlobal || isSlotProcessing}>
            <SelectTrigger className="w-full md:w-[250px] bg-background shadow-sm">
              <SelectValue placeholder="Select a Room or View All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROOMS_ID}>Show All Rooms</SelectItem>
              {rooms.map(room => (
                <SelectItem key={room.id} value={room.id}>{room.name} ({room.buildingName})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
          <h3 className="text-lg font-semibold text-foreground text-center md:text-left mr-3">
            {format(currentDate, 'MMM dd')} - {format(addDays(currentDate, 4), 'MMM dd, yyyy')}
          </h3>
          <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" onClick={handleToday} disabled={isProcessingGlobal || isSlotProcessing}>Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rooms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[900px]">
              <thead>
                <tr className="bg-muted/60">
                  <th className="p-2 border-b border-r text-left w-[120px] sticky left-0 bg-muted/95 z-20 font-semibold text-foreground align-top">Period</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={cn(
                        "p-2 border-b border-r text-center min-w-[160px] font-semibold text-foreground align-top",
                        isToday(day) ? 'bg-primary/10 text-primary-dark' : ''
                      )}>
                      {format(day, 'EEE')} <br /> <span className="font-normal text-xs text-muted-foreground">{format(day, 'MMM dd')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.name} className="even:bg-background odd:bg-muted/20">
                    <td className="p-2 border-r text-left sticky left-0 z-10 align-top h-28 even:bg-background odd:bg-muted/20">
                      <div className="font-medium text-foreground text-xs">{period.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const cellData = getCellDisplayData(day, period);
                      const slotStartDateTime = setHours(day, parseInt(period.start.split(':')[0]));
                      const isPastCell = isBefore(slotStartDateTime, new Date()) && !isSameDay(slotStartDateTime, new Date());
                      
                      const canInteract = !isProcessingGlobal && !isSlotProcessing &&
                                          !((isPastCell && !(cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID))) && // allow click on past booked for info
                                          !(cellData.status === 'all-booked' && selectedRoomId === ALL_ROOMS_ID);


                      return (
                        <td
                          key={day.toISOString() + period.name}
                          className={cn(getCellClasses(day, period), canInteract ? 'cursor-pointer' : 'cursor-default')}
                          onClick={() => canInteract && handleSlotClick(day, period)}
                        >
                          <div className="p-1 rounded-md text-[11px] min-h-full flex flex-col justify-between leading-snug">
                            <div className="flex-grow">
                               {cellData.displayText && (
                                <p className="whitespace-normal break-words opacity-90">{cellData.displayText}</p>
                              )}
                              {cellData.bookedBy && (
                                <div>
                                  <span className="text-red-600 font-semibold">{cellData.bookedBy}: </span>
                                  <span className="opacity-90">{cellData.purpose}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end items-center mt-1">
                                {!isPastCell && cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID && user?.uid === cellData.mainReservation.userId && (
                                    <Edit2 className="h-3 w-3 text-current opacity-70" />
                                )}
                                {cellData.status === 'available' && !isPastCell && (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 opacity-60" />
                                )}
                                {cellData.status === 'past-available' && (
                                    <CalendarX className="h-3.5 w-3.5 text-slate-400 opacity-50" />
                                )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">No rooms configured for booking.</p>
        )}
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{editingReservationId ? "Edit Booking" : "Book Slot"}</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-3">
              {(selectedRoomId === ALL_ROOMS_ID && !editingReservationId) && (
                <div className="space-y-1.5">
                  <Label htmlFor="modal-room-select" className="font-medium">Select Room</Label>
                  <Select
                    value={modalSelectedRoomIdForBooking}
                    onValueChange={setModalSelectedRoomIdForBooking}
                  >
                    <SelectTrigger id="modal-room-select" className="w-full">
                      <SelectValue placeholder="Choose an available room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms
                        .filter(room => getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, room.id).length === 0)
                        .map(room => (
                          <SelectItem key={room.id} value={room.id}>{room.name} ({room.buildingName})</SelectItem>
                      ))}
                       {rooms.filter(room => getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, room.id).length === 0).length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">No rooms available for this slot.</div>
                       )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-sm space-y-1">
                <p><strong>Room:</strong> { editingReservationId ? currentBookingSlot.existingReservation?.itemName : rooms.find(r=>r.id === (modalSelectedRoomIdForBooking || currentBookingSlot.room?.id))?.name || "N/A"}</p>
                <p><strong>Date:</strong> {format(currentBookingSlot.day, 'EEEE, MMM dd, yyyy')}</p>
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
              disabled={isSlotProcessing || isProcessingGlobal || !bookingPurpose.trim() || (selectedRoomId === ALL_ROOMS_ID && !editingReservationId && !modalSelectedRoomIdForBooking)}
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

