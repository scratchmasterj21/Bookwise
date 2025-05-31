
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon } from 'lucide-react'; // Added device icons
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
import { DEVICE_TYPES_WITH_ICONS } from '@/lib/constants';

const ALL_ITEMS_ID = "---all---"; // Generic ID for "all rooms" or "all devices"

type Item = Room | Device; // Generic item type

interface WeeklyBookingCalendarProps {
  items: Item[]; // Can be Room[] or Device[]
  itemType: 'room' | 'device';
  reservations: Reservation[];
  onBookSlot: (bookingDetails: {
    itemId: string;
    itemName: string;
    startTime: Date;
    endTime: Date;
    purpose: string; // Used as purpose for rooms, notes for devices
  }) => Promise<void>;
  onUpdateSlot: (reservationId: string, newPurposeOrNotes: string) => Promise<void>;
  onDeleteSlot: (reservationId: string) => void;
  periods: TimePeriod[];
  initialDate?: Date;
  isProcessingGlobal?: boolean;
  itemDisplayName?: string; // e.g., "Room" or "Device"
  bookingModalPurposeLabel?: string; // e.g. "Purpose/Class" or "Notes for Booking"
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'partially-booked' | 'all-booked' | 'past-available' | 'past-booked' | 'past-booked-all-view' | 'insufficient-quantity';
  isPast: boolean;
  displayText?: string;
  bookedBy?: string;
  purpose?: string; // or notes
  itemName?: string; // Room name or Device name
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation; // For single item view
  bookedCount?: number; // For device quantity checks
  itemQuantity?: number; // For device quantity checks
}

interface ItemStyling {
  borderClass: string;
  textClass: string;
  icon?: React.ElementType;
}


const getRoomStyling = (roomName?: string): ItemStyling => {
  const lowerRoomName = roomName?.toLowerCase() || "";
  if (lowerRoomName.includes('computer room')) return { borderClass: 'border-sky-400', textClass: 'text-sky-700' };
  if (lowerRoomName.includes('multipurpose room')) return { borderClass: 'border-purple-400', textClass: 'text-purple-700' };
  if (lowerRoomName.includes('music')) return { borderClass: 'border-orange-400', textClass: 'text-orange-700' };
  if (lowerRoomName.includes('agape hall')) return { borderClass: 'border-emerald-400', textClass: 'text-emerald-700' };
  return { borderClass: 'border-amber-400', textClass: 'text-amber-700' };
};

const getDeviceStyling = (deviceType?: DeviceType): ItemStyling => {
  switch (deviceType) {
    case 'Laptop': return { borderClass: 'border-blue-400', textClass: 'text-blue-700', icon: Laptop };
    case 'Tablet': return { borderClass: 'border-indigo-400', textClass: 'text-indigo-700', icon: Tablet };
    case 'Monitor': return { borderClass: 'border-gray-400', textClass: 'text-gray-700', icon: MonitorIcon };
    case 'Projector': return { borderClass: 'border-teal-400', textClass: 'text-teal-700', icon: ProjectorIcon };
    default: return { borderClass: 'border-slate-400', textClass: 'text-slate-700', icon: Package };
  }
};

const getItemStyling = (item: Item, itemType: 'room' | 'device'): ItemStyling => {
  if (itemType === 'room') {
    return getRoomStyling((item as Room).name);
  } else {
    return getDeviceStyling((item as Device).type);
  }
};


const getLastName = (fullName?: string): string => {
  if (!fullName) return 'User';
  const parts = fullName.split(' ');
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
};

const getIconForItemType = (itemType: 'room' | 'device', deviceType?: DeviceType): React.ElementType | undefined => {
  if (itemType === 'device') {
    const iconName = DEVICE_TYPES_WITH_ICONS[deviceType || 'Other'] || 'Package';
    switch(iconName) {
        case 'Laptop': return Laptop;
        case 'Tablet': return Tablet;
        case 'Monitor': return MonitorIcon;
        case 'Tv': return ProjectorIcon; // Assuming Tv is Projector
        default: return Package;
    }
  }
  return undefined; // No default icon for rooms in this context, styling is by name
};


export default function WeeklyBookingCalendar({
  items,
  itemType,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  periods,
  initialDate = new Date(),
  isProcessingGlobal = false,
  itemDisplayName = "Item",
  bookingModalPurposeLabel = "Purpose/Notes"
}: WeeklyBookingCalendarProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(startOfWeek(initialDate, { weekStartsOn: 1 }));
  const [selectedItemId, setSelectedItemId] = useState<string>(ALL_ITEMS_ID);

  const [isSlotProcessing, setIsSlotProcessing] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{day: Date, period: TimePeriod, item?: Item | null, existingReservation?: Reservation} | null>(null);
  const [bookingPurposeOrNotes, setBookingPurposeOrNotes] = useState('');
  const [modalSelectedItemIdForBooking, setModalSelectedItemIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);


  useEffect(() => {
    if (!bookingModalOpen) {
        setModalSelectedItemIdForBooking(undefined);
        setEditingReservationId(null);
        setBookingPurposeOrNotes('');
    }
  }, [bookingModalOpen]);


  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i));
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getReservationsForSlot = (day: Date, period: TimePeriod, itemIdForFilter?: string): Reservation[] => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.filter(res => {
      if (res.itemType !== itemType) return false; // Filter by item type (room/device)
      if (itemIdForFilter && res.itemId !== itemIdForFilter) return false;
      
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };

  const handleSlotAction = (day: Date, period: TimePeriod, actionType: 'book' | 'edit', existingReservation?: Reservation) => {
    if (isProcessingGlobal || isSlotProcessing) return;
     if (!user) {
      toast({ title: "Authentication required", description: "Please log in.", variant: "destructive" });
      return;
    }

    let targetItem: Item | undefined | null = null;

    if (actionType === 'edit' && existingReservation) {
      targetItem = items.find(i => i.id === existingReservation.itemId);
       const canManageBooking = isAdmin || existingReservation.userId === user.uid;
       if (!canManageBooking) {
        toast({ title: "Permission Denied", description: "You cannot edit this booking.", variant: "destructive"});
        return;
      }
      setCurrentBookingSlot({ day, period, item: targetItem, existingReservation });
      setBookingPurposeOrNotes(existingReservation.purpose || '');
      setEditingReservationId(existingReservation.id);
      setModalSelectedItemIdForBooking(existingReservation.itemId);
    } else if (actionType === 'book') {
        if (selectedItemId === ALL_ITEMS_ID) {
             setCurrentBookingSlot({ day, period, item: null }); 
             setModalSelectedItemIdForBooking(undefined); 
        } else {
             targetItem = items.find(i => i.id === selectedItemId);
             setCurrentBookingSlot({ day, period, item: targetItem });
             setModalSelectedItemIdForBooking(targetItem?.id); 
        }
        setBookingPurposeOrNotes('');
        setEditingReservationId(null);
    }
    setBookingModalOpen(true);
  };


  const confirmBookingOrUpdate = async () => {
    if (!currentBookingSlot || !user ) return;

    setIsSlotProcessing(true);
    const { day, period } = currentBookingSlot;

    let finalItemId = editingReservationId ? currentBookingSlot.existingReservation?.itemId : modalSelectedItemIdForBooking;

    if (!finalItemId && selectedItemId === ALL_ITEMS_ID && !editingReservationId) {
        toast({title: `${itemDisplayName} Selection Required`, description: `Please select a ${itemDisplayName.toLowerCase()} from the dropdown.`, variant: "destructive"});
        setIsSlotProcessing(false);
        return;
    }
    if(!finalItemId && selectedItemId !== ALL_ITEMS_ID) { 
        finalItemId = selectedItemId;
    }


    const itemToBookOrUpdate = items.find(i => i.id === finalItemId);

    if (!itemToBookOrUpdate) {
        toast({title: "Error", description: `Selected ${itemDisplayName.toLowerCase()} not found.`, variant: "destructive"})
        setIsSlotProcessing(false);
        setBookingModalOpen(false);
        return;
    }

    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      if (editingReservationId) {
        await onUpdateSlot(editingReservationId, bookingPurposeOrNotes.trim());
      } else {
        await onBookSlot({
            itemId: itemToBookOrUpdate.id,
            itemName: itemToBookOrUpdate.name,
            startTime,
            endTime,
            purpose: bookingPurposeOrNotes.trim() // This is 'purpose' for rooms, 'notes' for devices
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
    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPast = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    if (selectedItemId === ALL_ITEMS_ID) {
        const allSlotReservations = getReservationsForSlot(day, period);
        let bookedItemCount = 0;
        if (itemType === 'room') {
            bookedItemCount = new Set(allSlotReservations.map(res => res.itemId)).size;
        } else { // device
            allSlotReservations.forEach(res => {
                const device = items.find(d => d.id === res.itemId) as Device | undefined;
                if (device) { // This counts each reservation as one booked unit
                    bookedItemCount++;
                }
            });
        }
        const totalItemUnits = itemType === 'room' ? items.length : items.reduce((sum, item) => sum + ((item as Device).quantity || 0), 0);


        if (isPast) {
            if (bookedItemCount > 0) return { status: 'past-booked-all-view', isPast: true, displayText: `${bookedItemCount} ${itemDisplayName}(s) Booked` };
            return { status: 'past-available', isPast: true, displayText: "" };
        }
        if (totalItemUnits > 0 && bookedItemCount >= totalItemUnits) { // Check if all units are booked
            return { status: 'all-booked', isPast: false, displayText: `All ${itemDisplayName}s Booked` };
        }
        if (bookedItemCount > 0) {
             return { status: 'partially-booked', isPast: false, displayText: `${bookedItemCount}/${totalItemUnits} Booked` };
        }
        return { status: 'available', isPast: false, displayText: "Available" };
    }

    const currentItem = items.find(i => i.id === selectedItemId);
    if (!currentItem) return { status: 'past-available', isPast: true, displayText: ""}; // Should not happen

    const reservationsInSlot = getReservationsForSlot(day, period, selectedItemId);
    
    if (itemType === 'device') {
        const device = currentItem as Device;
        const bookedCount = reservationsInSlot.length;
        const availableQuantity = device.quantity - bookedCount;

        if (isPast) {
             if (bookedCount > 0) return {
                status: 'past-booked', isPast: true, bookedBy: reservationsInSlot[0]?.bookedBy, purpose: reservationsInSlot[0]?.purpose, itemName: device.name, isCurrentUserBooking: reservationsInSlot[0]?.userId === user?.uid, mainReservation: reservationsInSlot[0], bookedCount, itemQuantity: device.quantity
            };
            return { status: 'past-available', isPast: true, itemName: device.name, displayText: "" };
        }
        if (availableQuantity <= 0) {
            return { status: 'all-booked', isPast: false, itemName: device.name, displayText: "Fully Booked", bookedBy: reservationsInSlot[0]?.bookedBy, purpose: reservationsInSlot[0]?.purpose, isCurrentUserBooking: reservationsInSlot[0]?.userId === user?.uid, mainReservation: reservationsInSlot[0], bookedCount, itemQuantity: device.quantity };
        }
        // If some are booked but still available
        if (bookedCount > 0) {
             return { status: 'booked', isPast: false, bookedBy: reservationsInSlot[0]?.bookedBy, purpose: reservationsInSlot[0]?.purpose, itemName: device.name, isCurrentUserBooking: reservationsInSlot[0]?.userId === user?.uid, mainReservation: reservationsInSlot[0], displayText: `${availableQuantity} left`, bookedCount, itemQuantity: device.quantity };
        }
        return { status: 'available', isPast: false, itemName: device.name, displayText: `Available (${device.quantity})` };
    }

    // Room logic (remains largely the same)
    const mainReservation = reservationsInSlot[0];
    if (isPast) {
        if (mainReservation) return {
            status: 'past-booked', isPast: true, bookedBy: mainReservation.bookedBy, purpose: mainReservation.purpose, itemName: mainReservation.itemName, isCurrentUserBooking: mainReservation.userId === user?.uid, mainReservation
        };
        return { status: 'past-available', isPast: true, itemName: (currentItem as Room).name, displayText: "" };
    }
    if (mainReservation) {
        return {
            status: 'booked', isPast: false, bookedBy: mainReservation.bookedBy, purpose: mainReservation.purpose, itemName: mainReservation.itemName, isCurrentUserBooking: mainReservation.userId === user?.uid, mainReservation
        };
    }
    return { status: 'available', isPast: false, itemName: (currentItem as Room).name, displayText: "Available" };
  };

  const getCellClasses = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    let baseClasses = "p-0 border align-top h-[75px] relative group/cell";
    
    if (isToday(day)) {
        baseClasses = cn(baseClasses, "bg-primary/5");
    }

    const currentItem = items.find(i => i.id === selectedItemId);
    const itemStyling = currentItem ? getItemStyling(currentItem, itemType) : getRoomStyling(); // Default for "All" view

    if (cellData.isPast) {
        if (cellData.status === 'past-booked' || cellData.status === 'past-booked-all-view') {
            baseClasses = cn(baseClasses, `bg-slate-100 ${itemStyling.borderClass} border-dashed opacity-60 cursor-default`);
        } else { 
            baseClasses = cn(baseClasses, "bg-slate-50 border-slate-200 border-dashed cursor-default");
        }
    } else { 
        if (cellData.status === 'booked' && selectedItemId !== ALL_ITEMS_ID) {
            const backgroundClass = cellData.isCurrentUserBooking ? 'bg-green-50' : (itemType === 'room' ? 'bg-emerald-50' : 'bg-blue-50');
            baseClasses = cn(baseClasses, `${backgroundClass} ${itemStyling.borderClass} border-2`, "cursor-pointer");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 cursor-pointer transition-colors duration-150");
        } else if (cellData.status === 'all-booked') {
             baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-300 cursor-not-allowed", itemStyling.borderClass);
        } else if (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) { // All items view
            baseClasses = cn(baseClasses, "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700 cursor-pointer transition-colors duration-150");
        } else { 
            baseClasses = cn(baseClasses, "bg-card hover:bg-muted border-slate-200");
             if (selectedItemId === ALL_ITEMS_ID && cellData.status === 'available') {
                baseClasses = cn(baseClasses, "cursor-pointer");
            }
        }
    }
    return baseClasses;
  };

  const handleCellClick = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    if (isProcessingGlobal || isSlotProcessing) return;

    if (cellData.isPast) {
      if(cellData.mainReservation || cellData.status === 'past-booked-all-view') { 
        toast({
            title: `Past Booking (${cellData.itemName || itemDisplayName})`,
            description: cellData.status === 'past-booked-all-view' ? cellData.displayText : `${getLastName(cellData.bookedBy)} - ${cellData.purpose || 'N/A'}`
        });
      } else { 
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }
    
    const canManageCurrentBooking = isAdmin || cellData.isCurrentUserBooking;

    if ((cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device' && cellData.mainReservation)) && selectedItemId !== ALL_ITEMS_ID) { // Booked slot in single item view
        if (canManageCurrentBooking && cellData.mainReservation) {
            handleSlotAction(day, period, 'edit', cellData.mainReservation);
        } else { 
             toast({
                title: "Booking Details",
                description: `${cellData.itemName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || 'N/A'}`
            });
        }
    } else if (cellData.status === 'available' || (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID)) {
        handleSlotAction(day, period, 'book');
    } else if (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID) {
        toast({ title: `No ${itemDisplayName}s Available`, description: `All ${itemDisplayName.toLowerCase()}s are booked for this slot.`, variant: "default" });
    } else if (cellData.status === 'all-booked' && itemType === 'device' && selectedItemId !== ALL_ITEMS_ID && !canManageCurrentBooking) {
        toast({ title: "Fully Booked", description: `${cellData.itemName} is fully booked for this slot.` });
    }
  };


  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 pb-4 pt-4 px-4 border-b bg-primary/5">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={isProcessingGlobal || isSlotProcessing}>
            <SelectTrigger className="w-full md:w-[280px] bg-background shadow-sm">
              <SelectValue placeholder={`Select a ${itemDisplayName.toLowerCase()} or View All`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_ID}>Show All {itemDisplayName}s</SelectItem>
              {items.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    {itemType === 'device' && getIconForItemType(itemType, (item as Device).type) && 
                        React.createElement(getIconForItemType(itemType, (item as Device).type)!, {className: "h-4 w-4 text-muted-foreground"})}
                    {item.name} 
                    {itemType === 'room' && ` (${(item as Room).buildingName || 'N/A'})`}
                    {itemType === 'device' && ` (Qty: ${(item as Device).quantity})`}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
          <h3 className="text-lg font-semibold text-foreground text-center md:text-left mr-3">
            {format(currentDate, 'MMM dd')} - {format(addDays(currentDate, 4), 'MMM dd, yyyy')}
          </h3>
          <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Previous week" className="hover:bg-primary/10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" onClick={handleToday} disabled={isProcessingGlobal || isSlotProcessing} className="bg-accent text-accent-foreground hover:bg-accent/90">Today</Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Next week" className="hover:bg-primary/10">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[1020px]">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 border-b border-r text-center sticky left-0 bg-muted z-20 font-semibold text-foreground align-middle h-16 min-w-[150px]">Period</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={cn(
                        "p-2 border-b border-r text-center min-w-[180px] font-semibold text-foreground align-middle h-16",
                        isToday(day) ? 'bg-primary/20 text-primary-foreground' : ''
                      )}>
                      {format(day, 'EEE')} <br /> <span className="font-normal text-xs text-muted-foreground">{format(day, 'MMM dd')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.name} className="even:bg-background odd:bg-muted/20">
                    <td className="p-2 border-r text-center sticky left-0 z-10 align-middle h-[75px] even:bg-background odd:bg-muted/20 min-w-[150px]">
                       <div className="font-semibold text-foreground text-sm">{period.name}</div>
                       <div className="text-xs text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const slotKey = `${day.toISOString()}-${period.name}`;
                      const cellData = getCellDisplayData(day, period);
                      const currentItem = items.find(i => i.id === selectedItemId);
                      const itemStyling = currentItem ? getItemStyling(currentItem, itemType) : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());
                      
                      const canManageBooking = isAdmin || cellData.isCurrentUserBooking;
                      const showActions = canManageBooking && cellData.mainReservation && !cellData.isPast && selectedItemId !== ALL_ITEMS_ID && hoveredSlot === slotKey;

                      return (
                        <td
                          key={slotKey}
                          className={cn(getCellClasses(day, period), 'align-top')}
                          onClick={() => handleCellClick(day, period)}
                          onMouseEnter={() => setHoveredSlot(slotKey)}
                          onMouseLeave={() => setHoveredSlot(null)}
                        >
                           <div className="h-full w-full flex flex-col relative p-1.5">
                            { (cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device' && cellData.mainReservation)) && selectedItemId !== ALL_ITEMS_ID ? (
                               <div className={cn("flex flex-col text-left w-full h-full space-y-0.5", cellData.isPast ? "opacity-60" : "")}>
                                <div>
                                    <span className={cn("block font-semibold text-[11px] leading-tight", itemStyling.textClass)}>
                                        {cellData.itemName}
                                    </span>
                                    <span className="block font-semibold text-red-600 text-[10px] leading-tight">
                                        {getLastName(cellData.bookedBy)}
                                    </span>
                                    <span className="block text-slate-700 text-[10px] leading-tight break-words whitespace-normal mt-0.5">
                                        {cellData.purpose}
                                    </span>
                                    {itemType === 'device' && cellData.bookedCount !== undefined && cellData.itemQuantity !== undefined && (
                                      <span className="block text-xs text-muted-foreground mt-0.5">
                                        {cellData.bookedCount}/{cellData.itemQuantity} booked
                                      </span>
                                    )}
                                </div>
                              </div>
                            ) : (cellData.status === 'available' && !cellData.isPast) ? (
                                <div className="flex-grow flex flex-col items-center justify-center">
                                    <span className={cn("font-medium text-xs", selectedItemId !== ALL_ITEMS_ID ? "text-primary" : "text-muted-foreground")}>{cellData.displayText}</span>
                                </div>
                            ) : (cellData.status === 'partially-booked' || cellData.status === 'all-booked' ) && !cellData.isPast ? (
                                <div className="flex-grow flex flex-col items-center justify-center">
                                     <span className={cn(
                                      "text-xs",
                                      cellData.status === 'partially-booked' ? "text-sky-700" :
                                      cellData.status === 'all-booked' ? "text-red-700" :
                                      "text-muted-foreground" 
                                    )}>
                                        {cellData.displayText}
                                    </span>
                                </div>
                            ) : (cellData.isPast && cellData.status !== 'past-booked' && cellData.status !== 'past-booked-all-view') ? (
                                 <div className="flex-grow flex flex-col items-center justify-center"> {/* Blank for past available */} </div>
                            ) : (cellData.displayText && // For past-booked-all-view or other specific texts
                                 <div className="flex-grow flex flex-col items-center justify-center">
                                     <span className="text-xs text-muted-foreground">{cellData.displayText}</span>
                                </div>
                            )}

                            {showActions && cellData.mainReservation && (
                                <div className="absolute top-1 right-1 flex items-center space-x-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150">
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                      onClick={(e) => { e.stopPropagation(); cellData.mainReservation && handleSlotAction(day, period, 'edit', cellData.mainReservation); }}
                                      aria-label="Edit booking"
                                      disabled={isSlotProcessing || isProcessingGlobal}
                                    > <Edit2 className="h-3.5 w-3.5 text-blue-500" /> </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                                      onClick={(e) => { e.stopPropagation(); cellData.mainReservation && onDeleteSlot(cellData.mainReservation.id); }}
                                      aria-label="Delete booking"
                                      disabled={isSlotProcessing || isProcessingGlobal}
                                    > <Trash2 className="h-3.5 w-3.5 text-red-500" /> </Button>
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
          <p className="text-center text-muted-foreground py-12">No {itemDisplayName.toLowerCase()}s configured for booking.</p>
        )}
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{editingReservationId ? `Edit ${itemDisplayName} Booking` : `Book ${itemDisplayName} Slot`}</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-3">
              {(selectedItemId === ALL_ITEMS_ID && !editingReservationId) && (
                <div className="space-y-1.5">
                  <Label htmlFor="modal-item-select" className="font-medium">Select {itemDisplayName}</Label>
                  <Select
                    value={modalSelectedItemIdForBooking}
                    onValueChange={setModalSelectedItemIdForBooking}
                  >
                    <SelectTrigger id="modal-item-select" className="w-full">
                      <SelectValue placeholder={`Choose an available ${itemDisplayName.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter(item => {
                          const reservationsInSlot = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          if (itemType === 'device') {
                            return (item as Device).quantity - reservationsInSlot.length > 0;
                          }
                          return reservationsInSlot.length === 0; // For rooms
                        })
                        .map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                                {itemType === 'device' && getIconForItemType(itemType, (item as Device).type) && 
                                React.createElement(getIconForItemType(itemType, (item as Device).type)!, {className: "h-4 w-4 text-muted-foreground"})}
                                {item.name}
                                {itemType === 'device' && ` (Available: ${(item as Device).quantity - getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id).length})`}
                            </div>
                          </SelectItem>
                      ))}
                       {items.filter(item => {
                          const reservationsInSlot = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          if (itemType === 'device') return (item as Device).quantity - reservationsInSlot.length > 0;
                          return reservationsInSlot.length === 0;
                        }).length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">No {itemDisplayName.toLowerCase()}s available for this slot.</div>
                       )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-sm space-y-1">
                <p><strong>{itemDisplayName}:</strong> { editingReservationId ? currentBookingSlot.existingReservation?.itemName : items.find(i=>i.id === (modalSelectedItemIdForBooking || currentBookingSlot.item?.id))?.name || "N/A"}</p>
                <p><strong>Date:</strong> {format(currentBookingSlot.day, 'EEEE, MMM dd, yyyy')}</p>
                <p><strong>Period:</strong> {currentBookingSlot.period.name} ({currentBookingSlot.period.label})</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-purpose-notes" className="font-medium">{bookingModalPurposeLabel}:</Label>
                <Input
                  id="booking-purpose-notes"
                  value={bookingPurposeOrNotes}
                  onChange={(e) => setBookingPurposeOrNotes(e.target.value)}
                  placeholder={itemType === 'room' ? "e.g., Grade 5 Math Class" : "e.g., Project presentation"}
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
              disabled={isSlotProcessing || isProcessingGlobal || !bookingPurposeOrNotes.trim() || (selectedItemId === ALL_ITEMS_ID && !editingReservationId && !modalSelectedItemIdForBooking)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {(isSlotProcessing || isProcessingGlobal) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingReservationId ? `Update Booking` : `Confirm Booking`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
