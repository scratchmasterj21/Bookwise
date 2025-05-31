
"use client";

import React, { useState, useMemo } from 'react';
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
} from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';


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
  periods: TimePeriod[];
  initialDate?: Date;
  isBookingGlobal?: boolean; // To disable interactions while any booking is processing
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
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 })); // Monday
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  
  const [isSlotBooking, setIsSlotBooking] = useState(false); // Specific to one slot click
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod} | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState('');


  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i)); // Mon - Fri
  }, [currentDate]);

  const handlePrevWeek = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  const handleNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const handleToday = () => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getSlotBooking = (day: Date, period: TimePeriod, roomId: string): Reservation | undefined => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.find(res => {
      if (res.itemId !== roomId) return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      // Check for overlap: (StartA < EndB) and (EndA > StartB)
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };
  
  const handleSlotClick = (day: Date, period: TimePeriod) => {
    if (isBookingGlobal || isSlotBooking) return;

    if (!user) {
      toast({ title: "Authentication required", description: "Please log in to book.", variant: "destructive" });
      return;
    }
    if (!selectedRoomId) {
      toast({ title: "Room not selected", description: "Please select a room first.", variant: "destructive" });
      return;
    }

    const booking = getSlotBooking(day, period, selectedRoomId);
    if (booking) {
      toast({ title: "Slot Booked", description: `This slot is already booked by ${booking.bookedBy} for: ${booking.purpose}.`, variant: "default" });
      return;
    }
    
    setCurrentBookingSlot({day, period});
    setBookingPurpose(user.displayName ? `${user.displayName}'s Class/Booking` : "Class/Booking");
    setBookingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!currentBookingSlot || !user || !selectedRoomId) return;
    
    setIsSlotBooking(true); // Indicate this specific slot action is processing
    const {day, period} = currentBookingSlot;
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);
    if (!selectedRoom) {
        toast({title: "Error", description: "Selected room not found.", variant: "destructive"})
        setIsSlotBooking(false);
        setBookingModalOpen(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      await onBookSlot({ roomId: selectedRoomId, roomName: selectedRoom.name, startTime, endTime, purpose: bookingPurpose });
    } catch (error) {
      // Error toast is handled by onBookSlot's catch block in the parent
    } finally {
      setIsSlotBooking(false);
      setBookingModalOpen(false);
      setCurrentBookingSlot(null);
      setBookingPurpose('');
    }
  }


  const selectedRoomName = rooms.find(r => r.id === selectedRoomId)?.name || "Select Room";


  return (
    <Card className="shadow-lg w-full animate-subtle-fade-in">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0 pb-2">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={isBookingGlobal || isSlotBooking}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Select a Room" />
            </SelectTrigger>
            <SelectContent>
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
        {selectedRoomId ? (
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
                      const booking = getSlotBooking(day, period, selectedRoomId);
                      const cellDisabled = isBookingGlobal || isSlotBooking;

                      return (
                        <td
                          key={day.toISOString() + period.name}
                          className={`p-1 border align-top h-24 relative ${
                            booking ? (booking.bookedBy === 'Limpiada' ? 'bg-green-50' : 'bg-blue-50') // Example specific style
                                    : (cellDisabled ? 'bg-muted/30' : 'hover:bg-accent/30 cursor-pointer')
                          } ${cellDisabled && !booking ? 'cursor-not-allowed' : ''}`}
                          onClick={() => !booking && !cellDisabled && handleSlotClick(day, period)}
                        >
                          {booking ? (
                            <div className={`p-1.5 rounded-md text-xs ${booking.bookedBy === 'Limpiada' ? 'border-green-400 bg-green-100 text-green-800' : 'border-blue-400 bg-blue-100 text-blue-800'} border`}>
                              <div className="font-semibold truncate">{booking.itemName || selectedRoomName}</div>
                              {booking.bookedBy && <div className="text-primary truncate">{booking.bookedBy}</div>}
                              <div className="truncate">{booking.purpose}</div>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground text-xs p-2 flex items-center justify-center h-full">
                              {cellDisabled ? "Checking..." : "Available"}
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
          <p className="text-center text-muted-foreground py-10">Please select a room to view its schedule.</p>
        )}
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Slot</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-2">
              <p><strong>Room:</strong> {rooms.find(r=>r.id === selectedRoomId)?.name}</p>
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
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSlotBooking}>Cancel</Button>
            </DialogClose>
            <Button onClick={confirmBooking} disabled={isSlotBooking || !bookingPurpose.trim()}>
              {isSlotBooking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}
