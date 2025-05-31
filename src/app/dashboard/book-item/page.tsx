
"use client";

import React, { useState, useEffect } from 'react';
import WeeklyBookingCalendar from '@/components/reservations/WeeklyBookingCalendar';
import type { Room, Reservation, ReservationRequest, TimePeriod } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, addHours, setHours, setMinutes, startOfWeek } from 'date-fns'; // For mock data
import { format } from 'date-fns';

// Define periods (could be moved to a config file or fetched)
const TIME_PERIODS: TimePeriod[] = [
  { name: '1st Period', label: '09:00 - 09:45', start: '09:00', end: '09:45' },
  { name: '2nd Period', label: '09:50 - 10:35', start: '09:50', end: '10:35' },
  { name: '3rd Period', label: '10:55 - 11:40', start: '10:55', end: '11:40' },
  { name: '4th Period (Lower)', label: '11:45 - 12:30', start: '11:45', end: '12:30' },
  { name: '4th Period (Upper)', label: '12:35 - 13:20', start: '12:35', end: '13:20' },
  { name: '5th Period', label: '13:25 - 14:10', start: '13:25', end: '14:10' },
  { name: '6th Period', label: '14:15 - 15:00', start: '14:15', end: '15:00' },
];

const createTime = (date: Date, timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

const today = new Date();
const mondayThisWeek = startOfWeek(today, { weekStartsOn: 1 });
const tuesdayThisWeek = addDays(mondayThisWeek, 1);
const wednesdayThisWeek = addDays(mondayThisWeek, 2);
const thursdayThisWeek = addDays(mondayThisWeek, 3);
const fridayThisWeek = addDays(mondayThisWeek, 4);


const mockRooms: Room[] = [
  { id: 'compRoom1', name: 'Computer Room Limpiada', capacity: 20, status: 'available', category: 'Computer Room', imageUrl: 'https://placehold.co/600x400.png', description: 'Main computer lab.' },
  { id: 'musicRoom1', name: 'Music Room Miyamae', capacity: 15, status: 'available', category: 'Music Room', imageUrl: 'https://placehold.co/600x400.png', description: 'Music practice and recording room.' },
  { id: 'compRoom2', name: 'Computer Room G3B', capacity: 20, status: 'available', category: 'Computer Room', imageUrl: 'https://placehold.co/600x400.png', description: 'Secondary computer lab.' },
];

const generateInitialMockReservations = (userId: string, userName?: string): Reservation[] => [
  // Tuesday, 3rd Period, Computer Room Limpiada
  {
    id: 'res1', userId: 'teacher1', userName: 'Teacher A', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(tuesdayThisWeek, TIME_PERIODS[2].start), 
    endTime: createTime(tuesdayThisWeek, TIME_PERIODS[2].end), 
    status: 'approved', purpose: 'G3B Computer Class', bookedBy: 'Limpiada'
  },
  // Monday, 4th Period (Upper), Computer Room Limpiada
   {
    id: 'res2', userId: 'teacher2', userName: 'Teacher B', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(mondayThisWeek, TIME_PERIODS[4].start),
    endTime: createTime(mondayThisWeek, TIME_PERIODS[4].end),
    status: 'approved', purpose: 'G5B Computer Class (Gunma...)', bookedBy: 'Limpiada'
  },
  // Tuesday, 5th Period, Computer Room Limpiada
  {
    id: 'res3', userId: 'teacher3', userName: 'Teacher C', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(tuesdayThisWeek, TIME_PERIODS[5].start),
    endTime: createTime(tuesdayThisWeek, TIME_PERIODS[5].end),
    status: 'approved', purpose: 'G6B Computer Class', bookedBy: 'Limpiada'
  },
    // Wednesday, 5th Period, Computer Room Limpiada
  {
    id: 'res4', userId: 'teacher3', userName: 'Teacher C', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(wednesdayThisWeek, TIME_PERIODS[5].start),
    endTime: createTime(wednesdayThisWeek, TIME_PERIODS[5].end),
    status: 'approved', purpose: 'G3A Computer Class', bookedBy: 'Limpiada'
  },
  // Thursday, 5th Period, Music Room Miyamae
  {
    id: 'res5', userId: 'teacher4', userName: 'Teacher D', itemId: 'musicRoom1', itemName: 'Music Room Miyamae', itemType: 'room',
    startTime: createTime(thursdayThisWeek, TIME_PERIODS[5].start),
    endTime: createTime(thursdayThisWeek, TIME_PERIODS[5].end),
    status: 'approved', purpose: 'G1 Music', bookedBy: 'Miyamae'
  },
    // Thursday, 5th Period, Computer Room Limpiada (Concurrent with Music)
  {
    id: 'res6', userId: 'teacher2', userName: 'Teacher B', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(thursdayThisWeek, TIME_PERIODS[5].start),
    endTime: createTime(thursdayThisWeek, TIME_PERIODS[5].end),
    status: 'approved', purpose: 'G6A Computer Class', bookedBy: 'Limpiada'
  },
  // Friday, 5th Period, Music Room Miyamae
  {
    id: 'res7', userId: 'teacher4', userName: 'Teacher D', itemId: 'musicRoom1', itemName: 'Music Room Miyamae', itemType: 'room',
    startTime: createTime(fridayThisWeek, TIME_PERIODS[5].start),
    endTime: createTime(fridayThisWeek, TIME_PERIODS[5].end),
    status: 'approved', purpose: 'G3 Music', bookedBy: 'Miyamae'
  },
  // Monday, 6th Period, Music Room Miyamae
  {
    id: 'res8', userId: 'teacher1', userName: 'Teacher A',itemId: 'musicRoom1', itemName: 'Music Room Miyamae', itemType: 'room',
    startTime: createTime(mondayThisWeek, TIME_PERIODS[6].start),
    endTime: createTime(mondayThisWeek, TIME_PERIODS[6].end),
    status: 'approved', purpose: 'G2 Music', bookedBy: 'Miyamae'
  },
   // Tuesday, 6th Period, Computer Room Limpiada
  {
    id: 'res9', userId: 'teacher2', userName: 'Teacher B', itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(tuesdayThisWeek, TIME_PERIODS[6].start),
    endTime: createTime(tuesdayThisWeek, TIME_PERIODS[6].end),
    status: 'approved', purpose: 'G4A Computer Class', bookedBy: 'Limpiada'
  },
  // Wednesday, 6th Period, Computer Room Limpiada
  {
    id: 'res10', userId: 'teacher3', userName: 'Teacher C',itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(wednesdayThisWeek, TIME_PERIODS[6].start),
    endTime: createTime(wednesdayThisWeek, TIME_PERIODS[6].end),
    status: 'approved', purpose: 'G5A Computer Class', bookedBy: 'Limpiada'
  },
    // Friday, 6th Period, Computer Room Limpiada
  {
    id: 'res11', userId: 'teacher1', userName: 'Teacher A',itemId: 'compRoom1', itemName: 'Computer Room Limpiada', itemType: 'room',
    startTime: createTime(fridayThisWeek, TIME_PERIODS[6].start),
    endTime: createTime(fridayThisWeek, TIME_PERIODS[6].end),
    status: 'approved', purpose: 'G4B Computer Class', bookedBy: 'Limpiada'
  },
  // User's own booking for testing
  {
    id: 'myres1', userId: userId, userName: userName, itemId: 'musicRoom1', itemName: 'Music Room Miyamae', itemType: 'room',
    startTime: createTime(wednesdayThisWeek, TIME_PERIODS[0].start), // Wed, 1st Period
    endTime: createTime(wednesdayThisWeek, TIME_PERIODS[0].end),
    status: 'approved', purpose: 'My Practice', bookedBy: userName
  },
];


export default function BookItemPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [rooms, setRooms] = useState<Room[]>(mockRooms);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    setIsLoading(true);
    if (user) {
        setReservations(generateInitialMockReservations(user.uid, user.displayName || user.email || "User"));
    } else if (!authLoading) { // If not loading and no user
        setReservations(generateInitialMockReservations("guest-user", "Guest")); // Show some bookings even for guests
    }

    // If still no user after auth check, and no guest data loaded
    if (!authLoading && !user && reservations.length === 0) {
       setReservations(generateInitialMockReservations("guest-user", "Guest"));
    }

    setIsLoading(false);
  }, [user, authLoading]);

  const handleBookSlot = async (bookingDetails: {
    roomId: string;
    roomName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
  }) => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to book.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      userId: user.uid,
      userName: user.displayName || user.email,
      itemId: bookingDetails.roomId,
      itemName: bookingDetails.roomName,
      itemType: 'room', // Currently only rooms for this calendar
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      status: 'approved', // Auto-approve for demo
      purpose: bookingDetails.purpose,
      bookedBy: user.displayName || user.email || "User",
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 700));

    setReservations(prev => [...prev, newReservation]);
    toast({
      title: 'Room Booked!',
      description: `${bookingDetails.roomName} booked for ${format(bookingDetails.startTime, "MMM d, HH:mm")} - ${format(bookingDetails.endTime, "HH:mm")}. Purpose: ${bookingDetails.purpose}`,
    });
  };
  
  if (authLoading || isLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/4 mb-4" />
          <Skeleton className="h-12 w-1/3 mb-2" />
          <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold font-headline">Book a Room by Period</h2>
      <WeeklyBookingCalendar 
        rooms={rooms}
        reservations={reservations}
        onBookSlot={handleBookSlot}
        periods={TIME_PERIODS}
      />
    </div>
  );
}
