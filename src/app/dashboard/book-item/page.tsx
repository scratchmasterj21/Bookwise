
"use client";

import React, { useState, useEffect } from 'react';
import ReservationCalendar from '@/components/reservations/ReservationCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Device, Room, ReservationRequest, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import Image from 'next/image';
import { Laptop, Tablet, Monitor, Package, DoorOpen, Users, Building, CalendarCheck2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

const mockDevices: Device[] = [
  { id: 'laptop1', name: 'Dell XPS 15', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'High-performance laptop for demanding tasks.' },
  { id: 'laptop2', name: 'MacBook Pro 14"', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Powerful and portable Apple laptop.' },
  { id: 'tablet1', name: 'iPad Air', type: 'Tablet', status: 'booked', imageUrl: 'https://placehold.co/600x400.png', description: 'Lightweight tablet for on-the-go productivity.' },
  { id: 'monitor1', name: 'Dell 27" 4K Monitor', type: 'Monitor', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Crisp 4K display for enhanced visuals.' },
  { id: 'projector1', name: 'Epson Home Cinema', type: 'Projector', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Bright projector for presentations.' },
];

const mockRooms: Room[] = [
  { id: 'roomA', name: 'Conference Room A', capacity: 10, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Large room with AV equipment.', amenities: ['Projector', 'Whiteboard', 'Video Conferencing'] },
  { id: 'roomB', name: 'Meeting Room B', capacity: 4, status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Small, quiet room for focused meetings.', amenities: ['Whiteboard'] },
  { id: 'roomC', name: 'Huddle Space C', capacity: 2, status: 'booked', imageUrl: 'https://placehold.co/600x400.png', description: 'Compact space for quick discussions.', amenities: [] },
];

const ItemIcon = ({ itemType, deviceType }: { itemType: 'device' | 'room'; deviceType?: DeviceType }) => {
  if (itemType === 'device') {
    switch (deviceType) {
      case 'Laptop': return <Laptop className="h-5 w-5 text-primary" />;
      case 'Tablet': return <Tablet className="h-5 w-5 text-primary" />;
      case 'Monitor': return <Monitor className="h-5 w-5 text-primary" />;
      case 'Projector': return <Monitor className="h-5 w-5 text-primary" />; // Placeholder
      default: return <Package className="h-5 w-5 text-primary" />;
    }
  }
  return <Building className="h-5 w-5 text-primary" />;
};


export default function BookItemPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  
  const [itemType, setItemType] = useState<'device' | 'room' | ''>('');
  const [allItems, setAllItems] = useState<(Device | Room)[]>([]);
  const [filteredItems, setFilteredItems] = useState<(Device | Room)[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentItemDetails, setCurrentItemDetails] = useState<Device | Room | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    // Simulate fetching all items
    setTimeout(() => {
      setAllItems([...mockDevices, ...mockRooms]);
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (itemType) {
      if (itemType === 'device') {
        setFilteredItems(mockDevices.filter(d => d.status === 'available'));
      } else {
        setFilteredItems(mockRooms.filter(r => r.status === 'available'));
      }
    } else {
      setFilteredItems([]);
    }
    setSelectedItemId(null);
    setCurrentItemDetails(null);
  }, [itemType]);

  useEffect(() => {
    if (selectedItemId) {
      setCurrentItemDetails(allItems.find(item => item.id === selectedItemId) || null);
    } else {
      setCurrentItemDetails(null);
    }
  }, [selectedItemId, allItems]);

  const handleBookItem = async () => {
    if (!user || !currentItemDetails || !selectedDateRange?.from || !itemType) {
      toast({
        title: 'Missing Information',
        description: 'Please select an item type, item, date range, and ensure times are set.',
        variant: 'destructive',
      });
      return;
    }

    let finalStartTime: Date;
    let finalEndTime: Date;

    try {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        finalStartTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDateRange.from, startHours), startMinutes),0),0);

        const endDateRef = selectedDateRange.to || selectedDateRange.from; // Use 'to' if range, else 'from'
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        finalEndTime = setMilliseconds(setSeconds(setMinutes(setHours(endDateRef, endHours), endMinutes),0),0);
        
        if (finalEndTime <= finalStartTime) {
            toast({
                title: 'Invalid Time',
                description: 'End time must be after start time.',
                variant: 'destructive',
            });
            return;
        }

    } catch (error) {
        toast({
            title: 'Invalid Time Format',
            description: 'Please ensure start and end times are valid.',
            variant: 'destructive',
        });
        return;
    }


    setIsBooking(true);
    const reservationData: ReservationRequest = {
      itemId: currentItemDetails.id,
      itemName: currentItemDetails.name,
      itemType: itemType as 'device' | 'room',
      startTime: finalStartTime,
      endTime: finalEndTime,
    };

    console.log('Booking item:', reservationData);

    setTimeout(() => {
      toast({
        title: 'Item Booked!',
        description: `${currentItemDetails.name} has been booked from ${format(finalStartTime, "PPpp")} to ${format(finalEndTime, "PPpp")}.`,
      });
      setSelectedItemId(null);
      setCurrentItemDetails(null);
      setItemType('');
      setSelectedDateRange(undefined);
      setStartTime('09:00');
      setEndTime('17:00');
      setIsBooking(false);
    }, 1500);
  };
  
  if (authLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold font-headline">Book an Item</h2>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <ReservationCalendar 
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
          />
          <Card className="mt-4 shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg font-headline">Select Time</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                    <Label htmlFor="end-time">End Time</Label>
                    <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Select Item</CardTitle>
            <CardDescription>Choose an available item for your selected dates and times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-type-select">Item Type</Label>
              <Select
                onValueChange={(value) => setItemType(value as 'device' | 'room' | '')}
                value={itemType}
              >
                <SelectTrigger id="item-type-select" className="w-full">
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="device">Device</SelectItem>
                  <SelectItem value="room">Room</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {itemType && (isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
            <div className="space-y-2">
              <Label htmlFor="item-select">Available {itemType === 'device' ? 'Devices' : 'Rooms'}</Label>
              <Select
                onValueChange={(itemId) => setSelectedItemId(itemId)}
                value={selectedItemId || ""}
                disabled={!itemType || filteredItems.length === 0}
              >
                <SelectTrigger id="item-select" className="w-full">
                  <SelectValue placeholder={`Select a ${itemType}`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <ItemIcon itemType={itemType} deviceType={'type' in item ? (item as Device).type : undefined} />
                        <span>{item.name} {'capacity' in item ? `(Capacity: ${(item as Room).capacity})` : ''}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
               {filteredItems.length === 0 && <p className="text-sm text-muted-foreground">No available {itemType}s found.</p>}
            </div>
            ))}

            {currentItemDetails && (
              <Card className="mt-4 bg-muted/50 p-4 animate-subtle-fade-in">
                <CardHeader className="p-0 pb-2">
                  <div className="flex items-center gap-2">
                    <ItemIcon itemType={itemType as 'device' | 'room'} deviceType={'type' in currentItemDetails ? (currentItemDetails as Device).type : undefined} />
                    <CardTitle className="text-lg">{currentItemDetails.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 text-sm space-y-2">
                   {currentItemDetails.imageUrl && (
                     <div className="my-2 rounded-md overflow-hidden aspect-video relative w-full max-w-xs mx-auto">
                        <Image src={currentItemDetails.imageUrl} alt={currentItemDetails.name} layout="fill" objectFit="cover" data-ai-hint={itemType === 'device' ? "technology device" : "meeting room"} />
                     </div>
                   )}
                  <p className="text-muted-foreground">{(currentItemDetails as Device).description || (currentItemDetails as Room).description}</p>
                  {itemType === 'room' && 'capacity' in currentItemDetails && (
                    <>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" /> 
                            <span>Capacity: {(currentItemDetails as Room).capacity} people</span>
                        </div>
                        {(currentItemDetails as Room).amenities && ((currentItemDetails as Room).amenities?.length || 0) > 0 && (
                        <div>
                            <h4 className="font-medium text-foreground">Amenities:</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                            {(currentItemDetails as Room).amenities!.map(amenity => <li key={amenity}>{amenity}</li>)}
                            </ul>
                        </div>
                        )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleBookItem} 
              disabled={!currentItemDetails || !selectedDateRange?.from || isBooking || isLoading || !itemType} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isBooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck2 className="mr-2 h-4 w-4" />
              )}
              Book Item
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
