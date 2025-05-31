
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isSameDay,
  isBefore
} from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';

const ALL_ROOMS_ID = "---all---";

interface WeeklyBookingCalendarProps {
  rooms: Room[]; // These should be pre-filtered to 'available' status from parent
  reservations: Reservation[];
  onBookSlot: (bookingDetails: {
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    purpose: string; 
  }) => Promise<void>;
  periods: TimePeriod[];
  initialDate?: Date;
  isBookingGlobal?: boolean;
}

export default function WeeklyBookingCalendar({
  rooms,
  reservations,
  onBookSlot,
  periods,
  initialDate = new Date(),
  isBookingGlobal = false,
}: WeeklyBookingCalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }));
  const [selectedRoomId, setSelectedRoomId] = useState<string>(ALL_ROOMS_ID); // Default to "All Rooms"
  
  const [isSlotBooking, setIsSlotBooking] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [modalSelectedRoomIdForBooking, setModalSelectedRoomIdForBooking] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Reset modal room selection when main selection changes or modal closes
    if (!bookingModalOpen || (selectedRoomId !== ALL_ROOMS_ID)) {
        setModalSelectedRoomIdForBooking(undefined);
    }
  }, [selectedRoomId, bookingModalOpen]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i));
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getBookingForSpecificRoom = (day: Date, period: TimePeriod, roomId: string): Reservation | undefined => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);
    
    return reservations.find(res => {
      if (res.itemId !== roomId) return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };

  const isSlotBookedInAllRoomsView = (day: Date, period: TimePeriod): boolean => {
    // A slot is considered "booked" in "All Rooms" view if ALL available rooms are booked for that slot.
    // If at least one room is available, the slot is considered "Available" for booking selection.
    // This interpretation favors allowing booking if possible.
    for (const room of rooms) {
        if (!getBookingForSpecificRoom(day, period, room.id)) {
            return false; // Found an available room for this slot
        }
    }
    return rooms.length > 0; // All rooms are booked, or no rooms exist
  };
  
  const handleSlotClick = (day: Date, period: TimePeriod) => {
    if (isBookingGlobal || isSlotBooking || isBefore(setHours(day, 0,0,0,0), setHours(new Date(),0,0,0,0)) && !isSameDay(day, new Date())) {
      if (isBefore(day, new Date()) && !isSameDay(day, new Date())) {
        toast({ title: "Cannot book past dates", variant: "destructive" });
      }
      return;
    }

    if (!user) {
      toast({ title: "Authentication required", description: "Please log in to book.", variant: "destructive" });
      return;
    }

    const isAllRoomsView = selectedRoomId === ALL_ROOMS_ID;

    if (!isAllRoomsView) { // Specific room selected
      const booking = getBookingForSpecificRoom(day, period, selectedRoomId);
      if (booking) {
        toast({ title: "Slot Booked", description: `This slot is already booked by ${booking.bookedBy} for: ${booking.purpose}.`, variant: "default" });
        return;
      }
    } else { // "All Rooms" view
      // If the slot is visually marked as "Booked" (meaning all rooms are booked for it), don't proceed.
      // The check below handles if the slot *appeared* available but we need to ensure it is.
      const availableRoomsForSlot = rooms.filter(room => !getBookingForSpecificRoom(day, period, room.id));
      if (availableRoomsForSlot.length === 0 && rooms.length > 0) {
         toast({ title: "No Rooms Available", description: "All rooms are booked for this slot.", variant: "default" });
         return;
      }
    }
    
    setCurrentBookingSlot({day, period});
    setBookingPurpose(user.displayName ? `${user.displayName}'s Class/Booking` : "Class/Booking");
    if (isAllRoomsView) {
        setModalSelectedRoomIdForBooking(undefined); // Reset for "All Rooms" view
    }
    setBookingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!currentBookingSlot || !user ) return;
    
    const finalRoomId = selectedRoomId === ALL_ROOMS_ID ? modalSelectedRoomIdForBooking : selectedRoomId;
    
    if (!finalRoomId) {
        toast({title: "Room Selection Required", description: "Please select a room to book.", variant: "destructive"});
        return;
    }
    
    setIsSlotBooking(true);
    const {day, period} = currentBookingSlot;
    const roomToBook = rooms.find(r => r.id === finalRoomId);

    if (!roomToBook) {
        toast({title: "Error", description: "Selected room not found.", variant: "destructive"})
        setIsSlotBooking(false);
        setBookingModalOpen(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      await onBookSlot({ roomId: roomToBook.id, roomName: roomToBook.name, startTime, endTime, purpose: bookingPurpose });
    } catch (error) {
      // Error toast is handled by onBookSlot's catch block in the parent
    } finally {
      setIsSlotBooking(false);
      setBookingModalOpen(false);
      setCurrentBookingSlot(null);
      setBookingPurpose('');
      setModalSelectedRoomIdForBooking(undefined);
    }
  }

  const getCellDisplayData = (day: Date, period: TimePeriod) => {
    const isPast = isBefore(setHours(day, parseInt(period.end.split(':')[0]), parseInt(period.end.split(':')[1]),0,0), new Date()) && !isSameDay(day, new Date());
    if (isPast) return { booked: true, text: "Past", isPast: true };


    if (selectedRoomId === ALL_ROOMS_ID) {
        const availableRoomsForThisSlot = rooms.filter(r => !getBookingForSpecificRoom(day, period, r.id));
        if (availableRoomsForThisSlot.length === 0 && rooms.length > 0) {
            return { booked: true, text: "All Booked", mainBooking: null };
        }
        // If at least one room is available, show as available for selection in modal
        return { booked: false, text: "Available", mainBooking: null }; 
    }
    
    // Specific room selected
    const booking = getBookingForSpecificRoom(day, period, selectedRoomId);
    if (booking) {
        return { booked: true, text: `${booking.bookedBy}: ${booking.purpose}`, mainBooking: booking };
    }
    return { booked: false, text: "Available", mainBooking: null };
  };


  return (
    <Card className="shadow-lg w-full animate-subtle-fade-in">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0 pb-2">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={isBookingGlobal || isSlotBooking}>
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
          <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isBookingGlobal || isSlotBooking}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} disabled={isBookingGlobal || isSlotBooking}>Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isBookingGlobal || isSlotBooking}>
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
                    <th key={day.toISOString()} className="p-2 border text-center min-w-[120px]">
                      {format(day, 'EEE')} <br /> {format(day, 'MMM dd')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.name}>
                    <td className="p-2 border text-left sticky left-0 bg-card z-10">
                      <div className="font-semibold">{period.name}</div>
                      <div className="text-xs text-muted-foreground">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const cellData = getCellDisplayData(day, period);
                      const cellDisabled = isBookingGlobal || isSlotBooking || cellData.isPast || (selectedRoomId === ALL_ROOMS_ID && cellData.text === "All Booked");
                      const isActuallyBooked = cellData.booked && cellData.mainBooking; // For specific room view styling

                      return (
                        <td
                          key={day.toISOString() + period.name}
                          className={`p-1 border align-top h-24 relative ${
                            cellData.isPast ? 'bg-slate-100' : 
                            (isActuallyBooked ? (cellData.mainBooking?.bookedBy === 'Limpiada' ? 'bg-green-50' : 'bg-blue-50') 
                                    : (cellDisabled ? 'bg-muted/30' : 'hover:bg-accent/30 cursor-pointer'))
                          } ${cellDisabled && !isActuallyBooked ? 'cursor-not-allowed' : ''}`}
                          onClick={() => !cellData.booked && !cellDisabled && handleSlotClick(day, period)}
                        >
                          {cellData.booked ? (
                            <div className={`p-1.5 rounded-md text-xs ${ cellData.isPast ? 'border-slate-400 bg-slate-200 text-slate-700' :
                                (isActuallyBooked && cellData.mainBooking?.bookedBy === 'Limpiada' ? 'border-green-400 bg-green-100 text-green-800' : 'border-blue-400 bg-blue-100 text-blue-800')} border`}>
                              <div className="font-semibold truncate">{selectedRoomId !== ALL_ROOMS_ID && cellData.mainBooking ? cellData.mainBooking.itemName : rooms.find(r => r.id === selectedRoomId)?.name || "Room"}</div>
                              <div className="truncate">{cellData.text}</div>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground text-xs p-2 flex items-center justify-center h-full">
                              {cellDisabled && !cellData.isPast ? "Checking..." : cellData.text}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-10">No rooms currently available for booking.</p>
        )}
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Slot</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-2">
              {selectedRoomId === ALL_ROOMS_ID && (
                <div className="space-y-1">
                  <Label htmlFor="modal-room-select">Select Room</Label>
                  <Select 
                    value={modalSelectedRoomIdForBooking} 
                    onValueChange={setModalSelectedRoomIdForBooking}
                  >
                    <SelectTrigger id="modal-room-select">
                      <SelectValue placeholder="Choose a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms
                        .filter(room => !getBookingForSpecificRoom(currentBookingSlot.day, currentBookingSlot.period, room.id)) // Only show rooms available for this slot
                        .map(room => (
                          <SelectItem key={room.id} value={room.id}>{room.name} ({room.buildingName})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              { (selectedRoomId !== ALL_ROOMS_ID || modalSelectedRoomIdForBooking) && (
                <>
                  <p><strong>Room:</strong> {rooms.find(r=>r.id === (selectedRoomId === ALL_ROOMS_ID ? modalSelectedRoomIdForBooking : selectedRoomId))?.name}</p>
                  <p><strong>Date:</strong> {format(currentBookingSlot.day, 'EEEE, MMM dd, yyyy')}</p>
                  <p><strong>Period:</strong> {currentBookingSlot.period.name} ({currentBookingSlot.period.label})</p>
                  <div>
                    <Label htmlFor="booking-purpose">Purpose/Class:</Label>
                    <Input 
                      id="booking-purpose" 
                      value={bookingPurpose} 
                      onChange={(e) => setBookingPurpose(e.target.value)}
                      placeholder="e.g., G5 Math Class"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSlotBooking}>Cancel</Button>
            </DialogClose>
            <Button 
              onClick={confirmBooking} 
              disabled={isSlotBooking || !bookingPurpose.trim() || (selectedRoomId === ALL_ROOMS_ID && !modalSelectedRoomIdForBooking)}
            >
              {isSlotBooking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}
