
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2 } from 'lucide-react';
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
import { Badge } from '../ui/badge';

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
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod, room: Room | null, existingReservation?: Reservation} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [modalSelectedRoomIdForBooking, setModalSelectedRoomIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingModalOpen || (selectedRoomId !== ALL_ROOMS_ID)) {
        setModalSelectedRoomIdForBooking(undefined);
    }
    if (!bookingModalOpen) {
        setEditingReservationId(null);
        setBookingPurpose('');
    }
  }, [selectedRoomId, bookingModalOpen]);

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
      if (roomId && res.itemId !== roomId) return false; // Filter by specific room if ID provided
      if (res.itemType !== 'room') return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      // Check for overlap and ensure it's an active reservation
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };
  
  const handleSlotClick = (day: Date, period: TimePeriod) => {
    const slotDateTime = setHours(day, parseInt(period.start.split(':')[0]));
    const isPastSlot = isBefore(slotDateTime, new Date()) && !isSameDay(slotDateTime, new Date());

    if (isProcessingGlobal || isSlotProcessing) return;

    if (!user) {
      toast({ title: "Authentication required", description: "Please log in to book or edit.", variant: "destructive" });
      return;
    }

    const isAllRoomsView = selectedRoomId === ALL_ROOMS_ID;
    let targetRoom: Room | null = null;
    let existingResForSlot: Reservation | undefined = undefined;

    if (!isAllRoomsView) {
        targetRoom = rooms.find(r => r.id === selectedRoomId) || null;
        if (targetRoom) {
            existingResForSlot = getReservationsForSlot(day, period, targetRoom.id)[0]; // Get first one for this specific room
        }
    }

    if (existingResForSlot && !isPastSlot) { // Edit existing booking for current/future date
        setCurrentBookingSlot({ day, period, room: targetRoom, existingReservation: existingResForSlot });
        setBookingPurpose(existingResForSlot.purpose || '');
        setEditingReservationId(existingResForSlot.id);
        setBookingModalOpen(true);
    } else if (!existingResForSlot && !isPastSlot) { // New booking for current/future date
        if (isAllRoomsView) { // "All Rooms" view, need to select room in modal
            const availableRoomsForSlot = rooms.filter(r => getReservationsForSlot(day, period, r.id).length === 0);
            if (availableRoomsForSlot.length === 0 && rooms.length > 0) {
                toast({ title: "No Rooms Available", description: "All rooms are booked for this slot.", variant: "default" });
                return;
            }
             // For "All Rooms" view, `targetRoom` is initially null for a new booking
            setCurrentBookingSlot({ day, period, room: null });
            setModalSelectedRoomIdForBooking(undefined); // Reset for "All Rooms" view
        } else if (targetRoom) { // Specific room selected, new booking
            setCurrentBookingSlot({ day, period, room: targetRoom });
        } else {
            // Should not happen if a specific room is selected, but as a fallback
            toast({ title: "Error", description: "Selected room not found.", variant: "destructive" });
            return;
        }
        setBookingPurpose(''); // Clear purpose for new bookings
        setEditingReservationId(null);
        setBookingModalOpen(true);
    } else if (isPastSlot && existingResForSlot) {
        // Clicked on a past, booked slot - just show info
        toast({ title: "Past Booking", 
                description: `${existingResForSlot.itemName} was booked by ${existingResForSlot.bookedBy} for: ${existingResForSlot.purpose}.`, 
                duration: 5000 
              });
    } else if (isPastSlot) {
        toast({ title: "Past Slot", description: "This slot is in the past and cannot be booked.", variant: "default"});
    }
  };

  const confirmBookingOrUpdate = async () => {
    if (!currentBookingSlot || !user ) return;
    
    setIsSlotProcessing(true);
    const { day, period, room: initialRoomForSlot, existingReservation } = currentBookingSlot;
    
    let finalRoomId = selectedRoomId === ALL_ROOMS_ID ? modalSelectedRoomIdForBooking : selectedRoomId;
    if (existingReservation) { // If editing, use the reservation's item ID
        finalRoomId = existingReservation.itemId;
    }

    if (!finalRoomId && !existingReservation) { // For new booking, room must be selected
        toast({title: "Room Selection Required", description: "Please select a room to book.", variant: "destructive"});
        setIsSlotProcessing(false);
        return;
    }
    
    const roomToBookOrUpdate = rooms.find(r => r.id === finalRoomId);

    if (!roomToBookOrUpdate && !existingReservation) { // For new booking, ensure room exists
        toast({title: "Error", description: "Selected room not found.", variant: "destructive"})
        setIsSlotProcessing(false);
        setBookingModalOpen(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      if (editingReservationId && existingReservation) {
        await onUpdateSlot(editingReservationId, bookingPurpose.trim());
      } else if (roomToBookOrUpdate) { // New booking
        await onBookSlot({ 
            roomId: roomToBookOrUpdate.id, 
            roomName: roomToBookOrUpdate.name, 
            startTime, 
            endTime, 
            purpose: bookingPurpose.trim() 
        });
      } else {
        throw new Error("Invalid state for booking/update.");
      }
    } catch (error) {
      // Error toast is handled by onBookSlot/onUpdateSlot's catch block in the parent
    } finally {
      setIsSlotProcessing(false);
      setBookingModalOpen(false);
      setCurrentBookingSlot(null);
      setBookingPurpose('');
      setModalSelectedRoomIdForBooking(undefined);
      setEditingReservationId(null);
    }
  }

  const getCellDisplayData = (day: Date, period: TimePeriod) => {
    const slotStartDateTime = setHours(day, parseInt(period.start.split(':')[0]));
    const isPast = isBefore(slotStartDateTime, new Date()) && !isSameDay(slotStartDateTime, new Date());

    if (selectedRoomId === ALL_ROOMS_ID) {
        const allSlotReservations = getReservationsForSlot(day, period);
        const bookedRoomCount = new Set(allSlotReservations.map(res => res.itemId)).size;

        if (isPast) {
            if (bookedRoomCount > 0) return { text: `${bookedRoomCount} Booked`, isPast: true, status: 'past-booked' };
            return { text: "Past", isPast: true, status: 'past-available' };
        }
        if (bookedRoomCount === rooms.length && rooms.length > 0) {
            return { text: "All Booked", status: 'all-booked', mainReservation: null };
        }
        if (bookedRoomCount > 0) { // Some rooms booked, but not all
             return { text: `${bookedRoomCount}/${rooms.length} Booked`, status: 'partially-booked', mainReservation: null };
        }
        return { text: "Available", status: 'available', mainReservation: null };
    }
    
    // Specific room selected
    const reservationsInSlot = getReservationsForSlot(day, period, selectedRoomId);
    const mainReservation = reservationsInSlot[0]; // Take the first one if multiple (should not happen for same room/slot)

    if (isPast) {
        if (mainReservation) return { text: `${mainReservation.bookedBy}: ${mainReservation.purpose}`, isPast: true, status: 'past-booked', mainReservation };
        return { text: "Past", isPast: true, status: 'past-available', mainReservation: null };
    }

    if (mainReservation) {
        return { text: `${mainReservation.bookedBy}: ${mainReservation.purpose}`, status: 'booked', mainReservation };
    }
    return { text: "Available", status: 'available', mainReservation: null };
  };


  return (
    <Card className="shadow-lg w-full animate-subtle-fade-in">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0 pb-2">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={isProcessingGlobal || isSlotProcessing}>
            <SelectTrigger className="w-full md:w-[280px]">
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
          <h3 className="text-lg font-medium text-center md:text-left">
            Week: {format(currentDate, 'MMM dd')} - {format(addDays(currentDate, 4), 'MMM dd, yyyy')}
          </h3>
          <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isProcessingGlobal || isSlotProcessing}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} disabled={isProcessingGlobal || isSlotProcessing}>Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isProcessingGlobal || isSlotProcessing}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rooms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 border text-left w-1/6 sticky left-0 bg-muted z-10">Period</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={`p-2 border text-center min-w-[150px] md:min-w-[180px] ${isToday(day) ? 'bg-secondary' : ''}`}>
                      {format(day, 'EEE')} <br /> {format(day, 'MMM dd')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.name}>
                    <td className="p-2 border text-left sticky left-0 bg-card z-10 align-top">
                      <div className="font-semibold">{period.name}</div>
                      <div className="text-xs text-muted-foreground">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const cellData = getCellDisplayData(day, period);
                      const slotDateTime = setHours(day, parseInt(period.start.split(':')[0]));
                      const isStrictlyPastDay = isBefore(day, new Date()) && !isSameDay(day, new Date());
                      const isPastSlotTime = isBefore(setMinutes(slotDateTime, parseInt(period.end.split(':')[1])), new Date());
                      
                      const canInteract = !isProcessingGlobal && !isSlotProcessing && 
                                          !(cellData.isPast && !cellData.mainReservation) && // cannot book new on past available
                                          !(cellData.status === 'all-booked'); // cannot book new if all booked

                      let cellClasses = "p-1 border align-top h-24 relative";
                      if (cellData.isPast || (isSameDay(day, new Date()) && isPastSlotTime)) {
                        cellClasses += " bg-slate-100 text-slate-500";
                        if (!cellData.mainReservation) cellClasses += " cursor-not-allowed"; // Past and empty
                        else cellClasses += " hover:bg-slate-200 cursor-pointer"; // Past but booked (view details on click)
                      } else if (cellData.status === 'booked') {
                        cellClasses += " bg-blue-50 hover:bg-blue-100 cursor-pointer";
                      } else if (cellData.status === 'available' || cellData.status === 'partially-booked') {
                        cellClasses += " hover:bg-accent/30 cursor-pointer";
                      } else if (cellData.status === 'all-booked'){
                        cellClasses += " bg-rose-50 text-rose-700 cursor-not-allowed";
                      }


                      return (
                        <td
                          key={day.toISOString() + period.name}
                          className={cellClasses}
                          onClick={() => canInteract && handleSlotClick(day, period)}
                        >
                          <div className={`p-1.5 rounded-md text-xs min-h-[4rem] flex flex-col justify-between ${
                              cellData.isPast && cellData.mainReservation ? 'border-slate-400 bg-slate-200 text-slate-700' :
                              cellData.status === 'booked' ? 'border-blue-400 bg-blue-100 text-blue-800' :
                              cellData.status === 'all-booked' ? 'border-rose-400 bg-rose-100 text-rose-800' :
                              cellData.status === 'partially-booked' ? 'border-orange-400 bg-orange-50 text-orange-800' :
                              cellData.isPast ? 'opacity-70' : ''
                            } border`}>
                            <div>
                              {cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID && (
                                <div className="font-semibold truncate">{cellData.mainReservation.itemName}</div>
                              )}
                              <div className="truncate whitespace-normal break-words text-[11px] leading-tight">{cellData.text}</div>
                            </div>
                            {!cellData.isPast && cellData.mainReservation && selectedRoomId !== ALL_ROOMS_ID && user?.uid === cellData.mainReservation.userId &&(
                                <Edit2 className="h-3 w-3 text-blue-600 self-end mt-1" />
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
          <p className="text-center text-muted-foreground py-10">No rooms configured for booking.</p>
        )}
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReservationId ? "Edit Booking" : "Book Slot"}</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-2">
              {selectedRoomId === ALL_ROOMS_ID && !editingReservationId && (
                <div className="space-y-1">
                  <Label htmlFor="modal-room-select">Select Room</Label>
                  <Select 
                    value={modalSelectedRoomIdForBooking} 
                    onValueChange={setModalSelectedRoomIdForBooking}
                  >
                    <SelectTrigger id="modal-room-select">
                      <SelectValue placeholder="Choose an available room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms
                        .filter(room => getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, room.id).length === 0)
                        .map(room => (
                          <SelectItem key={room.id} value={room.id}>{room.name} ({room.buildingName})</SelectItem>
                      ))}
                       {rooms.filter(room => getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, room.id).length === 0).length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground">No rooms available for this slot.</div>
                       )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <p><strong>Room:</strong> { currentBookingSlot.existingReservation?.itemName || rooms.find(r=>r.id === (selectedRoomId === ALL_ROOMS_ID && !editingReservationId ? modalSelectedRoomIdForBooking : selectedRoomId))?.name || "N/A"}</p>
              <p><strong>Date:</strong> {format(currentBookingSlot.day, 'EEEE, MMM dd, yyyy')}</p>
              <p><strong>Period:</strong> {currentBookingSlot.period.name} ({currentBookingSlot.period.label})</p>
              <div>
                <Label htmlFor="booking-purpose">Purpose/Class:</Label>
                <Input 
                  id="booking-purpose" 
                  value={bookingPurpose} 
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  placeholder="e.g., Grade 5 Math Class"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSlotProcessing || isProcessingGlobal}>Cancel</Button>
            </DialogClose>
            <Button 
              onClick={confirmBookingOrUpdate} 
              disabled={isSlotProcessing || isProcessingGlobal || !bookingPurpose.trim() || (selectedRoomId === ALL_ROOMS_ID && !editingReservationId && !modalSelectedRoomIdForBooking)}
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
