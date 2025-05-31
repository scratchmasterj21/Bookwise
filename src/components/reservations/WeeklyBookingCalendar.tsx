
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
  status: string;
  isPast: boolean;
  displayText?: string;
  bookedBy?: string;
  purpose?: string;
  roomName?: string;
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation;
}

const getLastName = (fullName?: string): string => {
  if (!fullName) return 'N/A';
  const parts = fullName.split(' ');
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
};

const getCellBackgroundClasses = (roomName?: string, isCurrentUserBooking?: boolean, isPast?: boolean): string => {
  const hoverClass = isPast ? '' : 'hover:opacity-90 transition-opacity duration-150';

  if (isCurrentUserBooking && !isPast) {
    return `bg-green-100 border-green-300 ${hoverClass}`;
  }

  if (isPast) {
    if (roomName?.toLowerCase().includes('computer room')) return `bg-sky-50 border-sky-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('multipurpose room')) return `bg-purple-50 border-purple-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('music')) return `bg-orange-50 border-orange-200 ${hoverClass}`;
    if (roomName?.toLowerCase().includes('agape hall')) return `bg-emerald-50 border-emerald-200 ${hoverClass}`;
    return `bg-slate-100 border-slate-200 ${hoverClass}`; // Default past booked
  }

  // Another user's booking, not past
  if (roomName?.toLowerCase().includes('computer room')) return `bg-sky-100 border-sky-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('multipurpose room')) return `bg-purple-100 border-purple-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('music')) return `bg-orange-100 border-orange-300 ${hoverClass}`;
  if (roomName?.toLowerCase().includes('agape hall')) return `bg-emerald-100 border-emerald-300 ${hoverClass}`;
  return `bg-amber-100 border-amber-300 ${hoverClass}`; // Default for other's booking
};

const getRoomNameDisplayClasses = (roomName?: string): string => {
  if (roomName?.toLowerCase().includes('computer room')) return 'text-blue-600 font-semibold';
  if (roomName?.toLowerCase().includes('multipurpose room')) return 'text-purple-600 font-semibold';
  if (roomName?.toLowerCase().includes('music')) return 'text-orange-600 font-semibold';
  if (roomName?.toLowerCase().includes('agape hall')) return 'text-emerald-600 font-semibold';
  return 'text-gray-700 font-semibold'; // Default room name color
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

  const handleSlotClick = (day: Date, period: TimePeriod, isEditAction = false) => {
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

    if (targetRoom) { 
        existingResForSlot = getReservationsForSlot(day, period, targetRoom.id)[0];
    }

    if (isPastSlot && !isEditAction) { // Allow clicking past booked slots for info, but not for new booking
        if (existingResForSlot && targetRoom) { 
            toast({ title: "Past Booking",
                    description: `${existingResForSlot.itemName} by ${getLastName(existingResForSlot.bookedBy)}. Purpose: ${existingResForSlot.purpose || 'N/A'}.`,
                    duration: 5000
                  });
        } else { 
            toast({ title: "Past Slot", description: "This slot is in the past and cannot be booked or modified.", variant: "default"});
        }
        return;
    }
    
    if (existingResForSlot && targetRoom) { 
        if (existingResForSlot.userId !== user.uid && !isEditAction) { // Clicked on other's booking, not via edit icon
            toast({ title: "Booking Details",
                    description: `${existingResForSlot.itemName} by ${getLastName(existingResForSlot.bookedBy)}. Purpose: ${existingResForSlot.purpose || 'N/A'}.`,
                    duration: 5000
                  });
            return;
        }
        // If it's current user's booking OR it's an edit action (which implies it's user's)
        setCurrentBookingSlot({ day, period, room: targetRoom, existingReservation: existingResForSlot });
        setBookingPurpose(existingResForSlot.purpose || '');
        setEditingReservationId(existingResForSlot.id);
        setModalSelectedRoomIdForBooking(existingResForSlot.itemId); 
        setBookingModalOpen(true);
    } else if (!existingResForSlot) { 
        if (isAllRoomsView) {
            const availableRoomsForSlot = rooms.filter(r => getReservationsForSlot(day, period, r.id).length === 0);
            if (availableRoomsForSlot.length === 0 && rooms.length > 0) {
                toast({ title: "No Rooms Available", description: "All rooms are booked for this slot.", variant: "default" });
                return;
            }
            setCurrentBookingSlot({ day, period, room: null });
            setModalSelectedRoomIdForBooking(undefined); 
        } else if (targetRoom) { 
            setCurrentBookingSlot({ day, period, room: targetRoom });
            setModalSelectedRoomIdForBooking(targetRoom.id); 
        } else {
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

    if (!finalRoomId && selectedRoomId === ALL_ROOMS_ID) { 
        toast({title: "Room Selection Required", description: "Please select a room from the dropdown.", variant: "destructive"});
        setIsSlotProcessing(false);
        return;
    }
    if(!finalRoomId && selectedRoomId !== ALL_ROOMS_ID) { 
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

    const reservationsInSlot = getReservationsForSlot(day, period, selectedRoomId);
    const mainReservation = reservationsInSlot[0];
    const roomForSlot = rooms.find(r => r.id === selectedRoomId);

    if (isPast) {
        if (mainReservation) return {
            status: 'past-booked-specific-view',
            isPast: true,
            bookedBy: mainReservation.bookedBy || 'N/A',
            purpose: mainReservation.purpose || '',
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
            purpose: mainReservation.purpose || '',
            roomName: mainReservation.itemName,
            isCurrentUserBooking,
            mainReservation
        };
    }
    return { status: 'available', isPast: false, displayText: "Available", roomName: roomForSlot?.name };
  };

  const getCellClasses = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    let baseClasses = "p-1 border align-top h-28 relative text-xs";

    if (cellData.isPast) {
      if (cellData.status === 'past-booked-specific-view' || cellData.status === 'past-booked-all-view') {
         baseClasses = cn(baseClasses, getCellBackgroundClasses(cellData.roomName, cellData.isCurrentUserBooking, true), "cursor-pointer"); 
      } else {
         baseClasses = cn(baseClasses, "bg-slate-50 text-slate-400 cursor-not-allowed");
      }
    } else { 
      switch (cellData.status) {
        case 'available':
          baseClasses += " bg-green-50 hover:bg-green-100 text-green-700 cursor-pointer transition-colors duration-150";
          break;
        case 'booked-by-me':
        case 'booked-by-other':
          baseClasses = cn(baseClasses, getCellBackgroundClasses(cellData.roomName, cellData.isCurrentUserBooking, false), "cursor-pointer");
          break;
        case 'all-booked':
          baseClasses += " bg-red-100 text-red-700 cursor-not-allowed";
          break;
        case 'partially-booked': 
          baseClasses += " bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer transition-colors duration-150";
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
                                          !(isPastCell && !(cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID && !cellData.isCurrentUserBooking)) && // Allow click on past booked (others) for info
                                          !(cellData.status === 'all-booked' && selectedRoomId === ALL_ROOMS_ID);
                                          
                      const isEditableUserBooking = !isPastCell && cellData.mainReservation && cellData.isCurrentUserBooking && selectedRoomId !== ALL_ROOMS_ID;


                      return (
                        <td
                          key={day.toISOString() + period.name}
                          className={cn(getCellClasses(day, period), canInteract || isEditableUserBooking ? 'cursor-pointer' : 'cursor-default')}
                          onClick={() => (canInteract || isEditableUserBooking) && handleSlotClick(day, period)}
                        >
                          <div className="p-1.5 rounded-md text-[11px] min-h-full flex flex-col justify-between leading-snug relative">
                            <div className="flex-grow space-y-0.5">
                               {cellData.displayText && !cellData.mainReservation && (
                                <p className="whitespace-normal break-words opacity-90">{cellData.displayText}</p>
                              )}
                              {cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID && (
                                <>
                                  <div className={cn("text-xs", getRoomNameDisplayClasses(cellData.roomName))}>
                                    {cellData.roomName}
                                  </div>
                                  <div className="text-red-600 font-semibold text-xs">
                                    {getLastName(cellData.bookedBy)}
                                  </div>
                                  <div className="text-gray-600 text-[10px] break-words whitespace-normal leading-tight">
                                    {cellData.purpose}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="absolute top-0.5 right-0.5 flex items-center space-x-1">
                                {isEditableUserBooking && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleSlotClick(day, period, true); }} 
                                      className="p-0.5 hover:bg-blue-100 rounded"
                                      aria-label="Edit booking"
                                    >
                                      <Edit2 className="h-3 w-3 text-blue-500" />
                                    </button>
                                )}
                            </div>
                             <div className="flex justify-end items-end mt-1 self-end h-4">
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

