
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parse,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isWithinInterval,
  max,
  min,
} from 'date-fns';

interface WeeklyBookingCalendarProps {
  rooms: Room[];
  reservations: Reservation[];
  onBookSlot: (bookingDetails: {
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    purpose: string; // Default purpose for new booking
  }) => Promise<void>;
  periods: TimePeriod[];
  initialDate?: Date;
}

export default function WeeklyBookingCalendar({
  rooms,
  reservations,
  onBookSlot,
  periods,
  initialDate = new Date(),
}: WeeklyBookingCalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 })); // Monday
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  const [isBooking, setIsBooking] = useState(false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i));
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
      // Check for overlap: (ResStart < PeriodEnd) and (ResEnd > PeriodStart)
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime;
    });
  };
  
  const handleSlotClick = async (day: Date, period: TimePeriod) => {
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
      toast({ title: "Slot Booked", description: "This slot is already booked.", variant: "destructive" });
      return;
    }

    setIsBooking(true);
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);
    if (!selectedRoom) {
        toast({title: "Error", description: "Selected room not found.", variant: "destructive"})
        setIsBooking(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      // For demo, we'll use a generic purpose or prompt user later
      await onBookSlot({ roomId: selectedRoomId, roomName: selectedRoom.name, startTime, endTime, purpose: `${user.displayName}'s Booking` });
    } catch (error) {
      // Error toast is handled by onBookSlot
    } finally {
      setIsBooking(false);
    }
  };


  const selectedRoomName = rooms.find(r => r.id === selectedRoomId)?.name || "All Rooms";


  return (
    <Card className="shadow-lg w-full animate-subtle-fade-in">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-4">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a Room" />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="all">All Rooms</SelectItem> */}
              {rooms.map(room => (
                <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">
            Week of {format(currentDate, 'MMM dd, yyyy')}
          </h3>
          <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isBooking}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} disabled={isBooking}>Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isBooking}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 border text-left w-1/6">Period</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="p-2 border text-center">
                    {format(day, 'EEE')} <br /> {format(day, 'MMM dd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period.name}>
                  <td className="p-2 border text-left">
                    <div className="font-semibold">{period.name}</div>
                    <div className="text-xs text-muted-foreground">{period.label}</div>
                  </td>
                  {weekDays.map(day => {
                    const booking = selectedRoomId !== 'all' ? getSlotBooking(day, period, selectedRoomId) : undefined;
                    const isSlotDisabled = isBooking || (booking && booking.userId !== user?.uid && booking?.status !== 'cancelled');

                    return (
                      <td
                        key={day.toISOString() + period.name}
                        className={`p-1 border align-top h-24 ${
                          booking ? (booking.bookedBy === 'Limpiada' ? 'bg-green-100' : 'bg-blue-100') : 'hover:bg-accent/50 cursor-pointer'
                        }`}
                        onClick={() => !booking && handleSlotClick(day, period)}
                      >
                        {booking ? (
                          <div className={`p-1 rounded-md text-xs ${booking.bookedBy === 'Limpiada' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'} border`}>
                            <div className="font-semibold">{booking.itemName || selectedRoomName}</div>
                            {booking.bookedBy && <div className="text-primary">{booking.bookedBy}</div>}
                            <div>{booking.purpose}</div>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground text-xs p-2">Available</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
         {isBooking && <p className="text-center mt-4 text-primary">Processing booking...</p>}
      </CardContent>
    </Card>
  );
}

