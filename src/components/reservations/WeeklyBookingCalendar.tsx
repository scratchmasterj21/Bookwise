
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, CalendarX, CheckCircle, Trash2 } from 'lucide-react';
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
  onDeleteSlot: (reservationId: string) => void;
  periods: TimePeriod[];
  initialDate?: Date;
  isProcessingGlobal?: boolean;
}

interface CellDisplayInfo {
  status: string;
  isPast: boolean;
  displayText?: string;
  bookedBy?: string; // Full name from reservation
  purpose?: string;
  roomName?: string;
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation;
}

interface RoomStyling {
  borderClass: string;
  textClass: string;
  bgClass?: string; // For specific room bg if needed, otherwise default
}

const getRoomStyling = (roomName?: string): RoomStyling => {
  const lowerRoomName = roomName?.toLowerCase() || "";
  if (lowerRoomName.includes('computer room')) return { borderClass: 'border-sky-500', textClass: 'text-sky-700' };
  if (lowerRoomName.includes('multipurpose room')) return { borderClass: 'border-purple-500', textClass: 'text-purple-700' };
  if (lowerRoomName.includes('music')) return { borderClass: 'border-orange-500', textClass: 'text-orange-700' };
  if (lowerRoomName.includes('agape hall')) return { borderClass: 'border-emerald-500', textClass: 'text-emerald-700' };
  return { borderClass: 'border-slate-400', textClass: 'text-slate-700' }; // Default
};

const getLastName = (fullName?: string): string => {
  if (!fullName) return 'N/A';
  const parts = fullName.split(' ');
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
};


export default function WeeklyBookingCalendar({
  rooms,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  periods,
  initialDate = new Date(),
  isProcessingGlobal = false,
}: WeeklyBookingCalendarProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }));
  const [selectedRoomId, setSelectedRoomId] = useState<string>(ALL_ROOMS_ID);

  const [isSlotProcessing, setIsSlotProcessing] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod, room?: Room | null, existingReservation?: Reservation} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [modalSelectedRoomIdForBooking, setModalSelectedRoomIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null); // slotKey: `${day.toISOString()}-${period.name}`


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

  const handleSlotAction = (actionType: 'book' | 'edit', day: Date, period: TimePeriod, existingReservation?: Reservation) => {
    if (isProcessingGlobal || isSlotProcessing) return;
     if (!user) {
      toast({ title: "Authentication required", description: "Please log in.", variant: "destructive" });
      return;
    }

    const targetRoom = existingReservation ? rooms.find(r => r.id === existingReservation.itemId) : rooms.find(r => r.id === selectedRoomId);

    if (actionType === 'edit' && existingReservation) {
      setCurrentBookingSlot({ day, period, room: targetRoom, existingReservation });
      setBookingPurpose(existingReservation.purpose || '');
      setEditingReservationId(existingReservation.id);
      setModalSelectedRoomIdForBooking(existingReservation.itemId);
    } else if (actionType === 'book') {
        if (selectedRoomId === ALL_ROOMS_ID) {
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
    }
    setBookingModalOpen(true);
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
    const mainReservation = reservationsInSlot[0]; // Assuming one booking per room per slot
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
    let baseClasses = "p-1 border align-top h-[75px] relative text-xs group"; // Added group for hover parent

    const roomStyling = getRoomStyling(cellData.roomName);

    if (cellData.isPast) {
      if (cellData.status === 'past-booked-specific-view') {
         baseClasses = cn(baseClasses, `bg-slate-100 ${roomStyling.borderClass.replace('border-', 'border-slate-').replace(/[0-9]{3}/, '300')} opacity-70`, "cursor-default");
      } else if (cellData.status === 'past-booked-all-view') {
          baseClasses = cn(baseClasses, "bg-slate-100 border-slate-300 opacity-70 cursor-default");
      } else { // past-available
         baseClasses = cn(baseClasses, "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed");
      }
    } else { // Not past
      if (cellData.mainReservation) { // Booked slot
        baseClasses = cn(baseClasses, `bg-green-50 ${roomStyling.borderClass}`, "cursor-pointer");
      } else if (cellData.status === 'available') {
        baseClasses = cn(baseClasses, "bg-background hover:bg-green-50 border-slate-200 text-slate-500 cursor-pointer transition-colors duration-150 flex items-center justify-center");
      } else if (cellData.status === 'all-booked') {
         baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-200 cursor-not-allowed flex items-center justify-center");
      } else if (cellData.status === 'partially-booked') {
          baseClasses = cn(baseClasses, "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700 cursor-pointer transition-colors duration-150 flex items-center justify-center");
      } else {
          baseClasses = cn(baseClasses, "bg-card hover:bg-muted border-slate-200");
      }
    }
    return baseClasses;
  };

  const handleCellClick = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    if (isProcessingGlobal || isSlotProcessing || cellData.isPast) {
      if(cellData.isPast && cellData.mainReservation) {
        toast({
            title: "Past Booking",
            description: `${getLastName(cellData.bookedBy)} in ${cellData.roomName}: ${cellData.purpose || 'N/A'}`
        });
      } else if (cellData.isPast) {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }

    if (cellData.mainReservation) { // Booked slot
        // For non-admins and not their booking, show info. Admins/owners use hover buttons.
        if (!isAdmin && !cellData.isCurrentUserBooking) {
             toast({
                title: "Booking Details",
                description: `${getLastName(cellData.bookedBy)} in ${cellData.roomName}: ${cellData.purpose || 'N/A'}`
            });
        } else if (isAdmin || cellData.isCurrentUserBooking) {
            // Allow clicking cell to edit if admin or owner
            handleSlotAction('edit', day, period, cellData.mainReservation);
        }
    } else if (cellData.status === 'available') { // Available slot
        handleSlotAction('book', day, period);
    } else if (cellData.status === 'all-booked' && selectedRoomId === ALL_ROOMS_ID) {
        toast({ title: "No Rooms Available", description: "All rooms are booked for this slot.", variant: "default" });
    } else if (cellData.status === 'partially-booked' && selectedRoomId === ALL_ROOMS_ID) {
        handleSlotAction('book', day, period); // Open modal to select from available rooms
    }
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
            <table className="w-full border-collapse text-sm min-w-[1020px]">
              <thead>
                <tr className="bg-muted/60">
                  <th className="p-2 border-b border-r text-left w-[120px] sticky left-0 bg-muted/95 z-20 font-semibold text-foreground align-top h-12">Period</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={cn(
                        "p-2 border-b border-r text-center min-w-[180px] font-semibold text-foreground align-top h-12",
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
                    <td className="p-2 border-r text-left sticky left-0 z-10 align-top h-[75px] even:bg-background odd:bg-muted/20">
                      <div className="font-medium text-foreground text-xs">{period.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const slotKey = `${day.toISOString()}-${period.name}`;
                      const cellData = getCellDisplayData(day, period);
                      const roomStyling = getRoomStyling(cellData.roomName);
                      
                      const showActions = hoveredSlot === slotKey &&
                                           cellData.mainReservation &&
                                           !cellData.isPast &&
                                           selectedRoomId !== ALL_ROOMS_ID &&
                                           (isAdmin || cellData.isCurrentUserBooking);

                      return (
                        <td
                          key={slotKey}
                          className={cn(getCellClasses(day, period))}
                          onClick={() => handleCellClick(day, period)}
                          onMouseEnter={() => setHoveredSlot(slotKey)}
                          onMouseLeave={() => setHoveredSlot(null)}
                        >
                          <div className="p-1.5 rounded-md min-h-full flex flex-col justify-between leading-snug relative">
                             {cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID ? (
                                <div className="flex flex-col text-[10px] leading-tight space-y-0.5">
                                  <span className={cn("font-semibold", roomStyling.textClass)}>{cellData.roomName}</span>
                                  <span className="font-semibold text-red-600">{getLastName(cellData.bookedBy)}</span>
                                  <span className="text-slate-700 break-words whitespace-normal">{cellData.purpose}</span>
                                </div>
                              ) : cellData.displayText === "Available" && !cellData.isPast ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                   <CheckCircle className="h-5 w-5 text-green-500 opacity-70 mb-1" />
                                   <span className="text-[11px] text-green-600 font-medium">Available</span>
                                </div>
                              ) : cellData.displayText === "Past" && cellData.status === "past-available" ? (
                                 <div className="flex flex-col items-center justify-center h-full">
                                    <CalendarX className="h-5 w-5 text-slate-400 opacity-60 mb-1" />
                                    <span className="text-[11px] text-slate-500">Past</span>
                                 </div>
                              ) : cellData.displayText ? (
                                <div className="flex items-center justify-center h-full">
                                  <p className="text-[11px] text-center opacity-90">{cellData.displayText}</p>
                                </div>
                              ) : null }
                            
                            {showActions && cellData.mainReservation && (
                                <div className="absolute top-1 right-1 flex items-center space-x-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-1 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => { e.stopPropagation(); handleSlotAction('edit', day, period, cellData.mainReservation); }}
                                      aria-label="Edit booking"
                                    >
                                      <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => { e.stopPropagation(); onDeleteSlot(cellData.mainReservation!.id); }}
                                      aria-label="Delete booking"
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

