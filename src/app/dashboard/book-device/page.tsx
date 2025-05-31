"use client";

import React, { useState, useEffect } from 'react';
import ReservationCalendar from '@/components/reservations/ReservationCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Device, ReservationRequest } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import Image from 'next/image';
import { Laptop, Tablet, Monitor, Package, CalendarCheck2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const mockDevices: Device[] = [
  { id: 'laptop1', name: 'Dell XPS 15', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'High-performance laptop for demanding tasks.' },
  { id: 'laptop2', name: 'MacBook Pro 14"', type: 'Laptop', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Powerful and portable Apple laptop.' },
  { id: 'tablet1', name: 'iPad Air', type: 'Tablet', status: 'booked', imageUrl: 'https://placehold.co/600x400.png', description: 'Lightweight tablet for on-the-go productivity.' },
  { id: 'monitor1', name: 'Dell 27" 4K Monitor', type: 'Monitor', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Crisp 4K display for enhanced visuals.' },
  { id: 'projector1', name: 'Epson Home Cinema', type: 'Projector', status: 'available', imageUrl: 'https://placehold.co/600x400.png', description: 'Bright projector for presentations.' },
];

const DeviceIcon = ({ type }: { type: Device['type'] }) => {
  switch (type) {
    case 'Laptop': return <Laptop className="h-5 w-5 text-primary" />;
    case 'Tablet': return <Tablet className="h-5 w-5 text-primary" />;
    case 'Monitor': return <Monitor className="h-5 w-5 text-primary" />;
    case 'Projector': return <Monitor className="h-5 w-5 text-primary" />; // Placeholder, could use a presentation icon
    default: return <Package className="h-5 w-5 text-primary" />;
  }
};

export default function BookDevicePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    // Simulate fetching devices
    setIsLoading(true);
    setTimeout(() => {
      setAvailableDevices(mockDevices.filter(d => d.status === 'available'));
      setIsLoading(false);
    }, 500);
  }, []);

  const handleBookDevice = async () => {
    if (!user || !selectedDevice || !selectedDateRange?.from || !selectedDateRange?.to) {
      toast({
        title: 'Missing Information',
        description: 'Please select a device and a valid date range.',
        variant: 'destructive',
      });
      return;
    }

    setIsBooking(true);
    // Simulate API call for booking
    const reservationData: ReservationRequest = {
      itemId: selectedDevice.id,
      itemName: selectedDevice.name,
      itemType: 'device',
      startTime: selectedDateRange.from,
      endTime: selectedDateRange.to,
    };

    console.log('Booking device:', reservationData);

    setTimeout(() => {
      toast({
        title: 'Device Booked!',
        description: `${selectedDevice.name} has been booked from ${selectedDateRange.from?.toLocaleDateString()} to ${selectedDateRange.to?.toLocaleDateString()}.`,
      });
      // Reset form or navigate
      setSelectedDevice(null);
      setSelectedDateRange(undefined);
      setIsBooking(false);
      // Potentially refresh available devices list
    }, 1500);
  };
  
  if (authLoading) {
     return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold font-headline">Book a Device</h2>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <ReservationCalendar 
            selectedDateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
            // bookedDates={mockBookedDatesForDevice} // This would be dynamic based on selected device
          />
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Select Device</CardTitle>
            <CardDescription>Choose an available device for your selected dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
            <div className="space-y-2">
              <Label htmlFor="device-select">Available Devices</Label>
              <Select
                onValueChange={(deviceId) => {
                  const device = availableDevices.find(d => d.id === deviceId);
                  setSelectedDevice(device || null);
                }}
                value={selectedDevice?.id || ""}
              >
                <SelectTrigger id="device-select" className="w-full">
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      <div className="flex items-center gap-2">
                        <DeviceIcon type={device.type} />
                        <span>{device.name} ({device.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {selectedDevice && (
              <Card className="mt-4 bg-muted/50 p-4 animate-subtle-fade-in">
                <CardHeader className="p-0 pb-2">
                  <div className="flex items-center gap-2">
                    <DeviceIcon type={selectedDevice.type} />
                    <CardTitle className="text-lg">{selectedDevice.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 text-sm">
                   {selectedDevice.imageUrl && (
                     <div className="my-2 rounded-md overflow-hidden aspect-video relative w-full max-w-xs mx-auto">
                        <Image src={selectedDevice.imageUrl} alt={selectedDevice.name} layout="fill" objectFit="cover" data-ai-hint="technology device" />
                     </div>
                   )}
                  <p className="text-muted-foreground">{selectedDevice.description}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleBookDevice} 
              disabled={!selectedDevice || !selectedDateRange?.from || !selectedDateRange?.to || isBooking || isLoading} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isBooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck2 className="mr-2 h-4 w-4" />
              )}
              Book Device
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
