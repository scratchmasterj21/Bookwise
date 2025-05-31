
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon } from 'lucide-react';
import {
  format,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isSameDay,
  isBefore,
} from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DEVICE_TYPES_WITH_ICONS, DEVICE_PURPOSE_OPTIONS } from '@/lib/constants';


type Item = Room | Device;

interface DailyBookingTableProps {
  selectedDate: Date;
  items: Item[];
  itemType: 'room' | 'device';
  reservations: Reservation[];
  onBookSlot: (bookingDetails: {
    itemId: string;
    itemName: string;
    startTime: Date;
    endTime: Date;
    purpose?: string;
    devicePurposes?: string[];
    notes?: string;
    bookedQuantity?: number; // Added
  }) => Promise<void>;
  onUpdateSlot: (reservationId: string, newDetails: {
    purpose?: string;
    devicePurposes?: string[];
    notes?: string;
    bookedQuantity?: number; // Added
  }) => Promise<void>;
  onDeleteSlot: (reservationId: string) => void;
  periods: TimePeriod[];
  isProcessingGlobal?: boolean;
  itemDisplayName?: string;
  bookingModalPurposeLabel?: string;
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'past-available' | 'past-booked' | 'insufficient-quantity' | 'all-booked';
  isPast: boolean;
  displayText?: string;
  bookedBy?: string;
  purpose?: string;
  devicePurposes?: string[];
  notes?: string;
  bookedQuantity?: number; // Added
  itemName?: string;
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation; // Represents one of the bookings if multiple for devices
  bookedUnits?: number; // Total units booked for this device in this slot
  itemTotalQuantity?: number; // Total quantity of this device
}

interface ItemStyling {
  borderClass: string;
  textClass: string;
  backgroundClass: string;
  icon?: React.ElementType;
}

const getRoomStyling = (roomName?: string): ItemStyling => {
    const lowerRoomName = roomName?.toLowerCase() || "";
    if (lowerRoomName.includes('computer room')) return { borderClass: 'border-sky-400', textClass: 'text-sky-700', backgroundClass: 'bg-sky-50' };
    if (lowerRoomName.includes('multipurpose room')) return { borderClass: 'border-purple-400', textClass: 'text-purple-700', backgroundClass: 'bg-purple-50' };
    if (lowerRoomName.includes('music')) return { borderClass: 'border-orange-400', textClass: 'text-orange-700', backgroundClass: 'bg-orange-50' };
    if (lowerRoomName.includes('agape hall')) return { borderClass: 'border-emerald-400', textClass: 'text-emerald-700', backgroundClass: 'bg-emerald-50' };
    return { borderClass: 'border-amber-400', textClass: 'text-amber-700', backgroundClass: 'bg-amber-50' };
};

const getDeviceStyling = (deviceType?: DeviceType): ItemStyling => {
  const typeKey = deviceType || 'Other';
  const iconName = DEVICE_TYPES_WITH_ICONS[typeKey];
  let IconComponent;
  switch(iconName) {
    case 'Laptop': IconComponent = Laptop; break;
    case 'Tablet': IconComponent = Tablet; break;
    case 'Monitor': IconComponent = MonitorIcon; break;
    case 'Tv': IconComponent = ProjectorIcon; break;
    default: IconComponent = Package;
  }

  switch (deviceType) {
    case 'Laptop': return { borderClass: 'border-blue-400', textClass: 'text-blue-700', backgroundClass: 'bg-blue-50', icon: IconComponent };
    case 'Tablet': return { borderClass: 'border-indigo-400', textClass: 'text-indigo-700', backgroundClass: 'bg-indigo-50', icon: IconComponent };
    case 'Monitor': return { borderClass: 'border-gray-400', textClass: 'text-gray-700', backgroundClass: 'bg-gray-50', icon: IconComponent };
    case 'Projector': return { borderClass: 'border-teal-400', textClass: 'text-teal-700', backgroundClass: 'bg-teal-50', icon: IconComponent };
    default: return { borderClass: 'border-slate-400', textClass: 'text-slate-700', backgroundClass: 'bg-slate-50', icon: IconComponent };
  }
};

const getItemStyling = (item: Item, itemTypeProp: 'room' | 'device'): ItemStyling => {
  if (itemTypeProp === 'room') {
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

const getIconForItemType = (itemTypeProp: 'room' | 'device', deviceDetail?: DeviceType | string): React.ElementType | undefined => {
  if (itemTypeProp === 'device') {
    const iconName = DEVICE_TYPES_WITH_ICONS[deviceDetail as DeviceType || 'Other'] || 'Package';
    switch(iconName) {
        case 'Laptop': return Laptop;
        case 'Tablet': return Tablet;
        case 'Monitor': return MonitorIcon;
        case 'Tv': return ProjectorIcon;
        default: return Package;
    }
  }
  return undefined;
};


export default function DailyBookingTable({
  selectedDate,
  items,
  itemType,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  periods,
  isProcessingGlobal = false,
  itemDisplayName = "Item",
  bookingModalPurposeLabel = "Purpose/Notes"
}: DailyBookingTableProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [isSlotProcessing, setIsSlotProcessing] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [currentBookingSlot, setCurrentBookingSlot] = useState<{item: Item, period: TimePeriod, existingReservation?: Reservation} | null>(null);

  const [bookingPurpose, setBookingPurpose] = useState('');
  const [selectedDevicePurposes, setSelectedDevicePurposes] = useState<string[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingQuantity, setBookingQuantity] = useState<number>(1); // For device quantity

  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingModalOpen) {
        setEditingReservationId(null);
        setBookingPurpose('');
        setSelectedDevicePurposes([]);
        setBookingNotes('');
        setBookingQuantity(1);
    }
  }, [bookingModalOpen]);

  const handleDevicePurposeChange = (purpose: string) => {
    setSelectedDevicePurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    );
  };

  const getReservationsForSlot = (item: Item, period: TimePeriod, targetDate: Date): Reservation[] => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.filter(res => {
      if (res.itemId !== item.id || res.itemType !== itemType) return false;
      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return isSameDay(reservationStart, targetDate) &&
             reservationStart < periodEndDateTime &&
             reservationEnd > periodStartDateTime &&
             res.status !== 'cancelled' && res.status !== 'rejected';
    });
  };

  const handleSlotAction = (item: Item, period: TimePeriod, actionType: 'book' | 'edit', existingReservation?: Reservation) => {
    if (isProcessingGlobal || isSlotProcessing) return;
    if (!user) {
      toast({ title: "Authentication required", description: "Please log in.", variant: "destructive" });
      return;
    }

    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPastSlot = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    if (isPastSlot && actionType === 'book') {
        toast({title: "Past Slot", description: "This slot cannot be booked."});
        return;
    }

    if (actionType === 'edit' && existingReservation) {
      const canManageBooking = isAdmin || existingReservation.userId === user.uid;
      if (!canManageBooking) {
        toast({ title: "Permission Denied", description: "You cannot edit this booking.", variant: "destructive"});
        return;
      }
      setCurrentBookingSlot({ item, period, existingReservation });
      if (itemType === 'room') {
        setBookingPurpose(existingReservation.purpose || '');
      } else {
        setSelectedDevicePurposes(existingReservation.devicePurposes || []);
        setBookingNotes(existingReservation.notes || '');
        setBookingQuantity(existingReservation.bookedQuantity || 1);
      }
      setEditingReservationId(existingReservation.id);
    } else if (actionType === 'book') {
      setCurrentBookingSlot({ item, period });
      setBookingPurpose('');
      setSelectedDevicePurposes([]);
      setBookingNotes('');
      setBookingQuantity(1);
      setEditingReservationId(null);
    }
    setBookingModalOpen(true);
  };

  const confirmBookingOrUpdate = async () => {
    if (!currentBookingSlot || !user ) return;
    setIsSlotProcessing(true);

    const { item, period } = currentBookingSlot;
    const startTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const endTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    try {
      const details: any = {
        itemId: item.id,
        itemName: item.name,
        startTime,
        endTime,
      };
      if (itemType === 'room') {
        details.purpose = bookingPurpose.trim();
      } else {
        details.devicePurposes = selectedDevicePurposes;
        details.notes = bookingNotes.trim();
        details.bookedQuantity = bookingQuantity;
      }

      if (editingReservationId) {
        await onUpdateSlot(editingReservationId, details);
      } else {
        await onBookSlot(details);
      }
    } catch (error) {
    } finally {
      setIsSlotProcessing(false);
      setBookingModalOpen(false);
    }
  };

  const getCellDisplayData = (item: Item, period: TimePeriod): CellDisplayInfo => {
    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPast = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    const slotReservations = getReservationsForSlot(item, period, selectedDate);

    if (itemType === 'device') {
      const device = item as Device;
      const totalBookedUnits = slotReservations.reduce((sum, res) => sum + (res.bookedQuantity || 1), 0);
      const availableQuantity = device.quantity - totalBookedUnits;
      const firstReservation = slotReservations.find(r => r.userId === user?.uid) || slotReservations[0]; // Prioritize current user's booking for display

      if (isPast) {
        if (totalBookedUnits > 0) return {
            status: 'past-booked', isPast: true, bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, itemName: device.name, isCurrentUserBooking: !!slotReservations.find(r=>r.userId === user?.uid), mainReservation: firstReservation, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity
        };
        return { status: 'past-available', isPast: true, itemName: device.name, displayText: "" };
      }
      if (availableQuantity <= 0) {
        return { status: 'all-booked', isPast: false, itemName: device.name, displayText: "Fully Booked", bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, isCurrentUserBooking: !!slotReservations.find(r=>r.userId === user?.uid), mainReservation: firstReservation, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity };
      }
      if (totalBookedUnits > 0) {
        return { status: 'booked', isPast: false, bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, itemName: device.name, isCurrentUserBooking: !!slotReservations.find(r=>r.userId === user?.uid), mainReservation: firstReservation, displayText: `${availableQuantity} left`, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity };
      }
      return { status: 'available', isPast: false, itemName: device.name, displayText: `Available (${device.quantity})`, itemTotalQuantity: device.quantity };
    }

    const mainReservation = slotReservations[0];
    if (isPast) {
        if (mainReservation) return {
            status: 'past-booked', isPast: true, bookedBy: mainReservation.bookedBy, purpose: mainReservation.purpose, itemName: mainReservation.itemName, isCurrentUserBooking: mainReservation.userId === user?.uid, mainReservation
        };
        return { status: 'past-available', isPast: true, itemName: (item as Room).name, displayText: "" };
    }
    if (mainReservation) {
        return { status: 'booked', isPast: false, bookedBy: mainReservation.bookedBy, purpose: mainReservation.purpose, itemName: mainReservation.itemName, isCurrentUserBooking: mainReservation.userId === user?.uid, mainReservation };
    }
    return { status: 'available', isPast: false, itemName: (item as Room).name, displayText: "Available" };
  };

  const getCellClasses = (item: Item, period: TimePeriod) => {
    const cellData = getCellDisplayData(item, period);
    const itemStyling = getItemStyling(item, itemType);
    let baseClasses = "p-0 border align-top h-[70px] relative text-xs group/cell";

    if (cellData.isPast) {
        if (cellData.status === 'past-booked') {
            baseClasses = cn(baseClasses, `bg-slate-100 ${itemStyling.borderClass} border-dashed opacity-60 cursor-default`);
        } else {
            baseClasses = cn(baseClasses, "bg-slate-50 border-slate-200 border-dashed cursor-default");
        }
    } else {
        if (cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device')) {
            const bgClass = cellData.isCurrentUserBooking ? 'bg-green-50' : itemStyling.backgroundClass;
            baseClasses = cn(baseClasses, `${bgClass} ${itemStyling.borderClass} border-2`, "cursor-pointer");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 cursor-pointer transition-colors duration-150");
        } else if (cellData.status === 'all-booked' && itemType === 'room') {
            baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-300 cursor-not-allowed", itemStyling.borderClass);
        }
    }
    return baseClasses;
  };

  const handleCellClick = (item: Item, period: TimePeriod) => {
    const cellData = getCellDisplayData(item, period);
    if (isProcessingGlobal || isSlotProcessing) return;

    if (cellData.isPast) {
      if(cellData.mainReservation) {
        toast({
            title: "Past Booking",
            description: `${cellData.itemName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || cellData.devicePurposes?.join(', ') || 'N/A'}${itemType === 'device' ? ` (Qty: ${cellData.bookedQuantity || 1})` : ''}${cellData.notes ? `. Notes: ${cellData.notes}` : ''}`
        });
      } else {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }

    const canManageBooking = isAdmin || cellData.isCurrentUserBooking;

    if (cellData.mainReservation && (cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device'))) {
        if (canManageBooking) {
            handleSlotAction(item, period, 'edit', cellData.mainReservation);
        } else {
             toast({
                title: "Booking Details",
                description: `${cellData.itemName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || cellData.devicePurposes?.join(', ') || 'N/A'}${itemType === 'device' ? ` (Qty: ${cellData.bookedQuantity || 1})` : ''}${cellData.notes ? `. Notes: ${cellData.notes}` : ''}`
            });
        }
    } else if (cellData.status === 'available') {
        handleSlotAction(item, period, 'book');
    } else if (cellData.status === 'all-booked' && itemType === 'room') {
        toast({ title: "Fully Booked", description: `${item.name} is fully booked for this slot.`});
    }
  };

  const getMaxBookableQuantity = () => {
    if (!currentBookingSlot || itemType !== 'device') return 1;
    const { item, period, existingReservation } = currentBookingSlot;
    const device = item as Device;
    const reservationsInSlot = getReservationsForSlot(device, period, selectedDate);
    let totalBookedByOthers = 0;
    reservationsInSlot.forEach(res => {
      if (res.id !== existingReservation?.id) {
        totalBookedByOthers += (res.bookedQuantity || 1);
      }
    });
    const maxQty = device.quantity - totalBookedByOthers;
    return Math.max(0, maxQty); // Can be 0 if fully booked by others
  };


  const isBookingButtonDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal) return true;
    if (itemType === 'room' && !bookingPurpose.trim()) return true;
    if (itemType === 'device') {
        if (selectedDevicePurposes.length === 0) return true;
        if (bookingQuantity < 1 || bookingQuantity > getMaxBookableQuantity()) return true;
        if (!editingReservationId && getMaxBookableQuantity() === 0) return true; // Cannot book if 0 available for new booking
    }
    return false;
  };


  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[900px]">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 border-b border-r text-center sticky left-0 bg-muted z-20 font-semibold text-foreground align-middle h-16 min-w-[250px]">{itemDisplayName}</th>
                {periods.map(period => (
                  <th key={period.name} className={cn(
                      "p-2 border-b border-r text-center min-w-[120px] font-semibold text-foreground align-middle h-16",
                    )}>
                    {period.name} <br /> <span className="font-normal text-xs text-muted-foreground">{period.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="even:bg-background odd:bg-muted/20">
                  <td className="p-2 border-r text-left sticky left-0 z-10 align-middle h-[70px] even:bg-background odd:bg-muted/20 font-medium min-w-[250px] whitespace-nowrap">
                     <div className="flex items-center gap-2">
                        {getIconForItemType(itemType, itemType === 'device' ? (item as Device).type : item.name) &&
                           React.createElement(getIconForItemType(itemType, itemType === 'device' ? (item as Device).type : item.name)!, { className: "h-5 w-5 text-primary"})}
                        {itemType === 'device' ? `${(item as Device).roomName || 'N/A'} - ${item.name}` : item.name}
                     </div>
                     {itemType === 'room' && <div className="text-xs text-muted-foreground ml-7">{(item as Room).buildingName}</div>}
                     {itemType === 'device' && <div className="text-xs text-muted-foreground ml-7">Type: {(item as Device).type} (Qty: {(item as Device).quantity})</div>}
                  </td>
                  {periods.map(period => {
                    const slotKey = `${item.id}-${period.name}`;
                    const cellData = getCellDisplayData(item, period);
                    const itemStyling = getItemStyling(item, itemType);

                    const canManageBooking = isAdmin || cellData.isCurrentUserBooking;
                    const showActions = canManageBooking && cellData.mainReservation && !cellData.isPast && hoveredSlot === slotKey;

                    return (
                      <td
                        key={slotKey}
                        className={cn(getCellClasses(item, period))}
                        onClick={() => handleCellClick(item, period)}
                        onMouseEnter={() => setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <div className="h-full w-full flex flex-col relative p-1.5">
                          {cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device') ? (
                             <div className={cn("flex flex-col text-left w-full h-full space-y-0.5", cellData.isPast ? "opacity-60" : "")}>
                              <div className="flex-grow">
                                  <span className={cn("block font-semibold text-[10px] leading-tight", itemStyling.textClass)}>
                                      {cellData.itemName}
                                  </span>
                                  <span className="block font-semibold text-red-600 text-[10px] leading-tight">
                                      {getLastName(cellData.bookedBy)} {itemType === 'device' && `(Qty: ${cellData.bookedQuantity || 1})`}
                                  </span>
                                  {itemType === 'room' && cellData.purpose &&
                                    <span className="block text-slate-700 text-[10px] leading-tight break-words whitespace-normal mt-0.5">
                                        Purpose: {cellData.purpose}
                                    </span>
                                  }
                                  {itemType === 'device' && cellData.devicePurposes && cellData.devicePurposes.length > 0 &&
                                    <span className="block text-slate-700 text-[10px] leading-tight break-words whitespace-normal mt-0.5">
                                        Purposes: {cellData.devicePurposes.join(', ')}
                                    </span>
                                  }
                                  {itemType === 'device' && cellData.notes &&
                                    <span className="block text-slate-700 text-[10px] leading-tight break-words whitespace-normal mt-0.5">
                                        Notes: {cellData.notes}
                                    </span>
                                  }
                              </div>
                                {itemType === 'device' && cellData.displayText && cellData.status !== 'available' && (
                                      <span className="block text-xs text-muted-foreground mt-auto self-start">
                                          {cellData.displayText}
                                      </span>
                                  )}
                            </div>
                          ) : (cellData.status === 'available' || cellData.status === 'all-booked') && !cellData.isPast ? (
                              <div className="flex-grow flex flex-col items-center justify-center">
                                  <span className={cn("font-medium text-xs", cellData.status === 'available' ? "text-primary" : "text-red-600")}>{cellData.displayText}</span>
                              </div>
                          ) : cellData.status === 'past-available' ? (
                               <div className="flex-grow flex flex-col items-center justify-center">  </div>
                          ) : null}

                          {showActions && cellData.mainReservation && (
                              <div className="absolute top-1 right-1 flex items-center space-x-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150">
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                    onClick={(e) => { e.stopPropagation(); cellData.mainReservation && handleSlotAction(item, period, 'edit', cellData.mainReservation); }}
                                    aria-label="Edit booking" disabled={isSlotProcessing || isProcessingGlobal}
                                  > <Edit2 className="h-3.5 w-3.5 text-blue-500" /> </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                                    onClick={(e) => { e.stopPropagation(); cellData.mainReservation && onDeleteSlot(cellData.mainReservation.id); }}
                                    aria-label="Delete booking" disabled={isSlotProcessing || isProcessingGlobal}
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
      </CardContent>

      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{editingReservationId ? `Edit ${itemDisplayName} Booking` : `Book ${itemDisplayName} Slot`}</DialogTitle>
          </DialogHeader>
          {currentBookingSlot && (
            <div className="space-y-4 py-3">
              <div className="text-sm space-y-1">
                <p><strong>{itemDisplayName}:</strong> {currentBookingSlot.item.name}</p>
                <p><strong>Date:</strong> {format(selectedDate, 'EEEE, MMM dd, yyyy')}</p>
                <p><strong>Period:</strong> {currentBookingSlot.period.name} ({currentBookingSlot.period.label})</p>
                 {itemType === 'device' &&
                    <p><strong>Max Available to Book:</strong> {getMaxBookableQuantity()}</p>
                 }
              </div>

              {itemType === 'room' && (
                <div className="space-y-1.5">
                  <Label htmlFor="booking-purpose" className="font-medium">{bookingModalPurposeLabel}:</Label>
                  <Input
                    id="booking-purpose"
                    value={bookingPurpose}
                    onChange={(e) => setBookingPurpose(e.target.value)}
                    placeholder="e.g., Grade 5 Math Class"
                    className="text-sm"
                    disabled={isSlotProcessing || isProcessingGlobal}
                  />
                </div>
              )}

              {itemType === 'device' && (
                <>
                 <div className="space-y-1.5">
                    <Label htmlFor="booking-quantity" className="font-medium">Quantity to Book:</Label>
                    <Input
                      id="booking-quantity"
                      type="number"
                      value={bookingQuantity}
                      onChange={(e) => setBookingQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      min="1"
                      max={getMaxBookableQuantity()}
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal || getMaxBookableQuantity() === 0 && !editingReservationId}
                    />
                    {bookingQuantity > getMaxBookableQuantity() && <p className="text-xs text-red-500">Quantity exceeds available units ({getMaxBookableQuantity()}).</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Purpose (select all that apply):</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {DEVICE_PURPOSE_OPTIONS.map((purposeOpt) => (
                          <div key={purposeOpt} className="flex items-center space-x-2">
                            <Checkbox
                              id={`purpose-${purposeOpt.replace(/\s+/g, '-')}`}
                              checked={selectedDevicePurposes.includes(purposeOpt)}
                              onCheckedChange={() => handleDevicePurposeChange(purposeOpt)}
                              disabled={isSlotProcessing || isProcessingGlobal}
                            />
                            <Label htmlFor={`purpose-${purposeOpt.replace(/\s+/g, '-')}`} className="text-sm font-normal">
                              {purposeOpt}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-notes" className="font-medium">{bookingModalPurposeLabel}:</Label>
                    <Input
                      id="booking-notes"
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="e.g., Specific software needed"
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSlotProcessing || isProcessingGlobal}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={confirmBookingOrUpdate}
              disabled={isBookingButtonDisabled()}
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
