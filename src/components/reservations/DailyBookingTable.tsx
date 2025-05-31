
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon, CheckSquare } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DEVICE_TYPES_WITH_ICONS, DEVICE_PURPOSE_OPTIONS } from '@/lib/constants';


type Item = Room | Device;

interface BookingEntry {
  reservationId: string;
  bookedBy?: string;
  bookedQuantity: number; 
  isCurrentUserBooking: boolean;
  devicePurposes?: string[];
  notes?: string;
  purpose?: string; 
  itemName?: string;
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'past-available' | 'past-booked' | 'insufficient-quantity' | 'all-booked';
  isPast: boolean;
  displayText?: string;
  bookingEntries?: BookingEntry[];
  mainReservation?: Reservation;
  bookedUnits?: number;
  itemTotalQuantity?: number;
  availableQuantity?: number;
}

interface ItemStyling {
  borderClass: string;
  textClass: string;
  backgroundClass: string;
  icon?: React.ElementType;
}

interface SelectedMultiSlotInfoDaily {
  item: Item; 
  period: TimePeriod;
  availableInSlot: number;
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
  return fullName; 
};

const getIconForItemType = (itemTypeProp: 'room' | 'device', itemDetail?: DeviceType | string): React.ElementType | undefined => {
  if (itemTypeProp === 'device') {
    const iconName = DEVICE_TYPES_WITH_ICONS[itemDetail as DeviceType || 'Other'] || 'Package';
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
    bookedQuantity?: number;
  }) => Promise<void>;
  onUpdateSlot: (reservationId: string, newDetails: {
    purpose?: string;
    devicePurposes?: string[];
    notes?: string;
    bookedQuantity?: number;
  }) => Promise<void>;
  onDeleteSlot: (reservationId: string) => void;
  onConfirmMultiBookDaily?: (details: {
    itemId: string; 
    itemName: string; 
    periods: TimePeriod[];
    quantity?: number; 
    devicePurposes?: string[]; 
    notes?: string; 
    purpose?: string; 
  }) => Promise<void>;
  periods: TimePeriod[];
  isProcessingGlobal?: boolean;
  itemDisplayName?: string;
  bookingModalPurposeLabel?: string;
  key?: string | number; 
}


export default function DailyBookingTable({
  selectedDate,
  items,
  itemType,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  onConfirmMultiBookDaily,
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
  const [bookingQuantity, setBookingQuantity] = useState<number>(1); 

  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const [isMultiPeriodMode, setIsMultiPeriodMode] = useState(false);
  const [selectedMultiSlots, setSelectedMultiSlots] = useState<Map<string, SelectedMultiSlotInfoDaily>>(new Map());
  const [multiBookModalOpen, setMultiBookModalOpen] = useState(false);
  const [multiBookTargetItem, setMultiBookTargetItem] = useState<Item | null>(null);
  const [multiBookSelectedPeriodsForItem, setMultiBookSelectedPeriodsForItem] = useState<TimePeriod[]>([]);
  const [multiBookQuantity, setMultiBookQuantity] = useState<number>(1);
  const [multiBookPurposes, setMultiBookPurposes] = useState<string[]>([]);
  const [multiBookNotes, setMultiBookNotes] = useState('');
  const [multiBookRoomPurpose, setMultiBookRoomPurpose] = useState('');


  useEffect(() => {
    if (!bookingModalOpen) {
        setEditingReservationId(null);
        setBookingPurpose('');
        setSelectedDevicePurposes([]);
        setBookingNotes('');
        setBookingQuantity(1);
    }
  }, [bookingModalOpen]);

  useEffect(() => {
    if (!isMultiPeriodMode) {
      setSelectedMultiSlots(new Map());
    }
  }, [isMultiPeriodMode]);

  const handleDevicePurposeChange = (purpose: string) => {
    setSelectedDevicePurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    );
  };

  const handleMultiBookDevicePurposeChange = (purpose: string) => {
    setMultiBookPurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    );
  };

  const getReservationsForSlot = useCallback((item: Item, period: TimePeriod, targetDate: Date): Reservation[] => {
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
  }, [reservations, itemType]);

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
      if (itemType === 'room') {
        setBookingPurpose(''); 
      } else {
        setSelectedDevicePurposes([]);
        setBookingNotes('');
        setBookingQuantity(1);
      }
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
      // Error handled by parent
    } finally {
      setIsSlotProcessing(false);
      setBookingModalOpen(false);
    }
  };

  const getCellDisplayData = useCallback((item: Item, period: TimePeriod): CellDisplayInfo => {
    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPast = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    const slotReservations = getReservationsForSlot(item, period, selectedDate);
    const bookingEntries: BookingEntry[] = slotReservations.map(res => ({
        reservationId: res.id,
        bookedBy: res.bookedBy || res.userName,
        bookedQuantity: res.bookedQuantity || (itemType === 'device' ? 1 : 0),
        isCurrentUserBooking: res.userId === user?.uid,
        devicePurposes: res.devicePurposes,
        notes: res.notes,
        purpose: res.purpose, 
        itemName: res.itemName,
    }));

    const totalBookedUnits = bookingEntries.reduce((sum, entry) => sum + entry.bookedQuantity, 0);
    const itemTotalQuantity = itemType === 'device' ? (item as Device).quantity : 1;
    const availableQuantity = itemTotalQuantity - totalBookedUnits;
    const mainUserReservation = slotReservations.find(r => r.userId === user?.uid);

    if (isPast) {
        if (bookingEntries.length > 0) return { status: 'past-booked', isPast: true, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
        return { status: 'past-available', isPast: true, itemName: item.name, displayText: "" , itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits};
    }

    if (itemType === 'device' && availableQuantity <= 0) { 
        return { status: 'all-booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
    }
    if (bookingEntries.length > 0) { 
        return { status: itemType === 'room' ? 'all-booked' : 'booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
    }
    
    return { status: 'available', isPast: false, itemName: item.name, displayText: itemType === 'device' ? `Available (${itemTotalQuantity})` : "Available", itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits };
  }, [selectedDate, getReservationsForSlot, itemType, user]);

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
        const canInteract = !isMultiPeriodMode || (isMultiPeriodMode && ( (itemType === 'device' && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0) || (itemType === 'room' && cellData.status === 'available')));
        if (cellData.status === 'booked' || cellData.status === 'all-booked') { 
            const mainUserRes = cellData.bookingEntries?.find(be => be.isCurrentUserBooking);
            const backgroundClass = mainUserRes ? 'bg-green-50' : (cellData.status === 'all-booked' ? 'bg-red-50' : itemStyling.backgroundClass);
            const borderColorClass = cellData.status === 'all-booked' ? 'border-red-300' : itemStyling.borderClass;

            baseClasses = cn(baseClasses, `${backgroundClass} ${borderColorClass} ${cellData.status === 'all-booked' ? '' : 'border-2'}`, (cellData.mainReservation || cellData.status !== 'all-booked') && canInteract ? "cursor-pointer" : "cursor-not-allowed");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 cursor-pointer transition-colors duration-150", canInteract ? "cursor-pointer" : "cursor-default");
        }
    }
    return baseClasses;
  };

  const handleCellClick = (item: Item, period: TimePeriod) => {
    const cellData = getCellDisplayData(item, period);
    if (isProcessingGlobal || isSlotProcessing) return;

    if (isMultiPeriodMode) {
      const isRoomAvailableForMultiSelect = itemType === 'room' && !cellData.isPast && cellData.status === 'available';
      const isDeviceAvailableForMultiSelect = itemType === 'device' && !cellData.isPast && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0;

      if (isRoomAvailableForMultiSelect || isDeviceAvailableForMultiSelect) {
        const slotKey = `${item.id}-${period.name}`;
        const newSelectedSlots = new Map(selectedMultiSlots);
        if (newSelectedSlots.has(slotKey)) {
          newSelectedSlots.delete(slotKey);
        } else {
          newSelectedSlots.set(slotKey, { item, period, availableInSlot: itemType === 'device' ? (cellData.availableQuantity || 0) : 1 });
        }
        setSelectedMultiSlots(newSelectedSlots);
      } else if (cellData.isPast || ( (itemType === 'device' && (cellData.availableQuantity === undefined || cellData.availableQuantity <=0)) || (itemType === 'room' && cellData.status !== 'available'))) {
        toast({ title: "Cannot Select Slot", description: "This slot is unavailable or in the past.", variant: "destructive" });
      }
      return; 
    }

    if (cellData.isPast) {
      if(cellData.bookingEntries && cellData.bookingEntries.length > 0) {
        const description = itemType === 'device'
            ? cellData.bookingEntries.map(be => `${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})${be.devicePurposes && be.devicePurposes.length > 0 ? ` - ↳ ${be.devicePurposes.join(', ')}` : ''}${be.notes ? ` - ↳ Notes: ${be.notes}`:''}`).join('; ')
            : `${getLastName(cellData.bookingEntries[0].bookedBy)} - ${cellData.bookingEntries[0].purpose}`;
        toast({
            title: `Past Booking (${cellData.bookingEntries[0].itemName || itemDisplayName})`,
            description
        });
      } else {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }

    if (cellData.mainReservation && (cellData.status === 'booked' || cellData.status === 'all-booked')) {
        if (isAdmin || cellData.mainReservation.userId === user?.uid) {
             handleSlotAction(item, period, 'edit', cellData.mainReservation);
        } else { 
            const bookingDetailsString = cellData.bookingEntries?.map(be => `${getLastName(be.bookedBy)}${itemType === 'device' ? ` (Qty: ${be.bookedQuantity})` : ''}${be.devicePurposes ? ` - ↳ ${be.devicePurposes.join(', ')}` : be.purpose ? ` - ↳ ${be.purpose}` : ''}`).join('; ');
            toast({ title: "Booking Details", description: `${item.name}: ${bookingDetailsString}` });
        }
    } else if (cellData.status === 'available' || (cellData.status === 'booked' && itemType === 'device')) { 
        handleSlotAction(item, period, 'book');
    } else if (cellData.status === 'all-booked' && !(cellData.mainReservation && (isAdmin || cellData.mainReservation.userId === user?.uid))) { 
         const bookingDetailsString = cellData.bookingEntries?.map(be => `${getLastName(be.bookedBy)}${itemType === 'device' ? ` (Qty: ${be.bookedQuantity})` : ''}`).join('; ');
         toast({ title: "Fully Booked", description: `${item.name}: ${bookingDetailsString}`, variant: "default" });
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
    return Math.max(0, maxQty);
  };

  const isBookingButtonDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal) return true;
    if (itemType === 'room') {
        if (!bookingPurpose.trim()) return true;
    } else { // device
        if (selectedDevicePurposes.length === 0) return true;
        if (bookingQuantity < 1) return true;
        const maxQty = getMaxBookableQuantity();
        if (bookingQuantity > maxQty) return true;
        if (!editingReservationId && maxQty === 0) return true;
    }
    return false;
  };

  const handleOpenMultiBookModal = () => {
    if (selectedMultiSlots.size === 0 || !onConfirmMultiBookDaily) return;

    const itemIds = new Set(Array.from(selectedMultiSlots.values()).map(slot => slot.item.id));
    if (itemIds.size > 1) {
      toast({ title: "Multiple Item Types", description: `Please select periods for only one ${itemDisplayName.toLowerCase()} at a time for multi-booking.`, variant: "destructive" });
      return;
    }
    if (itemIds.size === 0) return; 

    const targetItemId = Array.from(itemIds)[0];
    const item = items.find(d => d.id === targetItemId);
    if (!item) return;

    const periodsForItem = Array.from(selectedMultiSlots.values())
      .filter(slot => slot.item.id === targetItemId)
      .map(slot => slot.period);

    setMultiBookTargetItem(item);
    setMultiBookSelectedPeriodsForItem(periodsForItem);
    if (itemType === 'device') {
      setMultiBookQuantity(1);
      setMultiBookPurposes([]);
      setMultiBookNotes('');
    } else {
      setMultiBookRoomPurpose('');
    }
    setMultiBookModalOpen(true);
  };

  const maxQuantityForMultiBookDevice = useMemo(() => {
    if (!multiBookTargetItem || multiBookSelectedPeriodsForItem.length === 0 || itemType !== 'device') return 0;
    let minAvailable = Infinity;
    multiBookSelectedPeriodsForItem.forEach(period => {
      const cellData = getCellDisplayData(multiBookTargetItem, period);
      minAvailable = Math.min(minAvailable, cellData.availableQuantity || 0);
    });
    return minAvailable === Infinity ? 0 : minAvailable;
  }, [multiBookTargetItem, multiBookSelectedPeriodsForItem, getCellDisplayData, itemType]);

  const confirmMultiBookDaily = async () => {
    if (!onConfirmMultiBookDaily || !multiBookTargetItem || multiBookSelectedPeriodsForItem.length === 0 || isSlotProcessing) return;

    const multiBookDetails: any = {
        itemId: multiBookTargetItem.id,
        itemName: multiBookTargetItem.name,
        periods: multiBookSelectedPeriodsForItem,
    };

    if (itemType === 'device') {
        if (multiBookPurposes.length === 0) {
          toast({ title: "Purpose Required", description: "Please select at least one purpose.", variant: "destructive" });
          return;
        }
        if (multiBookQuantity < 1 || multiBookQuantity > maxQuantityForMultiBookDevice) {
          toast({ title: "Invalid Quantity", description: `Quantity must be between 1 and ${maxQuantityForMultiBookDevice}.`, variant: "destructive" });
          return;
        }
        multiBookDetails.quantity = multiBookQuantity;
        multiBookDetails.devicePurposes = multiBookPurposes;
        multiBookDetails.notes = multiBookNotes;
    } else { 
        if (!multiBookRoomPurpose.trim()) {
            toast({ title: "Purpose Required", description: "Please enter a purpose for the room booking.", variant: "destructive" });
            return;
        }
        multiBookDetails.purpose = multiBookRoomPurpose.trim();
    }

    setIsSlotProcessing(true);
    try {
      await onConfirmMultiBookDaily(multiBookDetails);
      setSelectedMultiSlots(new Map());
      setIsMultiPeriodMode(false);
    } catch (error) {
        // Error handled by parent
    } finally {
      setIsSlotProcessing(false);
      setMultiBookModalOpen(false);
    }
  };
  
  const isMultiBookConfirmDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal || !multiBookTargetItem || multiBookSelectedPeriodsForItem.length === 0) return true;
    if (itemType === 'device') {
      return multiBookPurposes.length === 0 || multiBookQuantity < 1 || multiBookQuantity > maxQuantityForMultiBookDevice || maxQuantityForMultiBookDevice === 0;
    } else { 
      return !multiBookRoomPurpose.trim();
    }
  };


  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardContent className="p-0">
        {onConfirmMultiBookDaily && items.length > 0 && (
          <div className="p-2 border-b flex items-center justify-end space-x-3 bg-muted/50">
            {isMultiPeriodMode && selectedMultiSlots.size > 0 && (
               <Button
                 onClick={handleOpenMultiBookModal}
                 size="sm"
                 className="bg-accent hover:bg-accent/90 text-accent-foreground"
                 disabled={isProcessingGlobal || isSlotProcessing}
               >
                 <CheckSquare className="mr-2 h-4 w-4" />
                 Book {selectedMultiSlots.size} Selected Slot(s)
               </Button>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="daily-multi-period-mode"
                checked={isMultiPeriodMode}
                onCheckedChange={setIsMultiPeriodMode}
                disabled={isProcessingGlobal || isSlotProcessing}
              />
              <Label htmlFor="daily-multi-period-mode" className="text-sm text-foreground whitespace-nowrap">
                Select Multiple Periods
              </Label>
            </div>
          </div>
        )}
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
                  <td className="p-2 border-r text-center sticky left-0 z-10 align-middle h-[70px] even:bg-background odd:bg-muted/20 font-medium min-w-[250px] whitespace-nowrap">
                     <div className="flex items-center justify-center gap-2">
                        {getIconForItemType(itemType, itemType === 'device' ? (item as Device).type : item.name) &&
                           React.createElement(getIconForItemType(itemType, itemType === 'device' ? (item as Device).type : item.name)!, { className: "h-5 w-5 text-primary"})}
                        {itemType === 'device' ? `${(item as Device).roomName || 'N/A'} - ${item.name}` : item.name}
                     </div>
                     {itemType === 'room' && <div className="text-xs text-muted-foreground text-center">{(item as Room).buildingName}</div>}
                     {itemType === 'device' && <div className="text-xs text-muted-foreground text-center">Type: {(item as Device).type} (Total Qty: {(item as Device).quantity})</div>}
                  </td>
                  {periods.map(period => {
                    const slotKey = `${item.id}-${period.name}`;
                    const cellData = getCellDisplayData(item, period);
                    const itemStyling = getItemStyling(item, itemType);

                    const showActions = cellData.mainReservation && (isAdmin || cellData.mainReservation.userId === user?.uid) && !cellData.isPast && hoveredSlot === slotKey && !isMultiPeriodMode;
                    
                    const isSlotBookableForMultiSelect = !cellData.isPast && (
                        (itemType === 'device' && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0) ||
                        (itemType === 'room' && cellData.status === 'available')
                    );

                    return (
                      <td
                        key={slotKey}
                        className={cn(getCellClasses(item, period))}
                        onClick={() => handleCellClick(item, period)}
                        onMouseEnter={() => setHoveredSlot(slotKey)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <div className="h-full w-full flex flex-col relative p-1.5 text-left overflow-y-auto">
                           {isMultiPeriodMode && isSlotBookableForMultiSelect && (
                              <div className="absolute top-1 left-1 z-10">
                                <Checkbox
                                  checked={selectedMultiSlots.has(slotKey)}
                                  onCheckedChange={() => {
                                    if (isSlotBookableForMultiSelect) {
                                      const newSelectedSlots = new Map(selectedMultiSlots);
                                      if (newSelectedSlots.has(slotKey)) {
                                        newSelectedSlots.delete(slotKey);
                                      } else {
                                        newSelectedSlots.set(slotKey, { item, period, availableInSlot: itemType === 'device' ? (cellData.availableQuantity || 0) : 1 });
                                      }
                                      setSelectedMultiSlots(newSelectedSlots);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select slot for ${item.name} at ${period.name}`}
                                />
                              </div>
                            )}
                          { (cellData.status === 'booked' || cellData.status === 'all-booked') && cellData.bookingEntries && cellData.bookingEntries.length > 0 ? (
                             <div className={cn("flex flex-col w-full h-full space-y-0.5 text-xs leading-tight", cellData.isPast ? "opacity-60" : "", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                <span className={cn("block font-semibold text-sm", itemStyling.textClass)}>
                                  {cellData.bookingEntries[0].itemName}
                                </span>
                                <ScrollArea className="h-[calc(100%-30px)] pr-1"> 
                                  <ul className="space-y-0.5">
                                    {cellData.bookingEntries.map(entry => (
                                      <li key={entry.reservationId} className={cn("pb-0.5 mb-0.5 border-b border-slate-200 last:border-b-0",entry.isCurrentUserBooking && "font-semibold text-primary")}>
                                        {getLastName(entry.bookedBy)}{itemType === 'device' ? ` (Qty: ${entry.bookedQuantity})` : ''}
                                        {itemType === 'room' && entry.purpose && <span className="block text-slate-600 text-[10px] pl-2">↳ {entry.purpose}</span>}
                                        {itemType === 'device' && entry.devicePurposes && entry.devicePurposes.length > 0 && <span className="block text-slate-600 text-[10px] pl-2">↳ {entry.devicePurposes.join(', ')}</span>}
                                        {itemType === 'device' && entry.notes && <span className="block text-slate-500 text-[10px] pl-2">↳ Notes: {entry.notes}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </ScrollArea>
                                {itemType === 'device' && !cellData.isPast && (
                                    <div className="mt-auto pt-0.5 text-[10px]">
                                        {cellData.availableQuantity !== undefined && cellData.availableQuantity > 0 && <span className="text-green-600 font-medium">({cellData.availableQuantity} remaining)</span>}
                                        {cellData.availableQuantity !== undefined && cellData.availableQuantity <= 0 && <span className="text-red-600 font-medium">(Fully Booked)</span>}
                                    </div>
                                )}
                            </div>
                          ) : (cellData.status === 'available' && !cellData.isPast) ? (
                              <div className={cn("flex-grow flex flex-col items-center justify-center", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                  <span className={cn("font-medium text-xs text-primary")}>{cellData.displayText}</span>
                              </div>
                          ) : cellData.isPast && cellData.status === 'past-booked' && cellData.bookingEntries && cellData.bookingEntries.length > 0 ? (
                              <div className={cn("flex flex-col w-full h-full space-y-0.5 text-xs leading-tight opacity-60")}>
                                  <span className={cn("block font-semibold text-sm", itemStyling.textClass)}>{cellData.bookingEntries[0].itemName}</span>
                                  <ul className="space-y-0.5">
                                    {cellData.bookingEntries.map(entry => (
                                      <li key={entry.reservationId} className="pb-0.5 mb-0.5 border-b border-slate-200 last:border-b-0">
                                        {getLastName(entry.bookedBy)}{itemType === 'device' ? ` (Qty: ${entry.bookedQuantity})` : ''}
                                        {itemType === 'room' && entry.purpose && <span className="block text-slate-600 text-[10px] pl-2">↳ {entry.purpose}</span>}
                                        {itemType === 'device' && entry.devicePurposes && entry.devicePurposes.length > 0 && <span className="block text-slate-600 text-[10px] pl-2">↳ {entry.devicePurposes.join(', ')}</span>}
                                        {itemType === 'device' && entry.notes && <span className="block text-slate-500 text-[10px] pl-2">↳ Notes: {entry.notes}</span>}
                                      </li>
                                    ))}
                                  </ul>
                              </div>
                          ) : (cellData.isPast && (cellData.status === 'past-available' || !cellData.displayText)) ? (
                               <div className="flex-grow flex flex-col items-center justify-center">  </div>
                          ) : null }

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
                    <p><strong>Max Available to Book Now:</strong> {getMaxBookableQuantity()}</p>
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
                      disabled={isSlotProcessing || isProcessingGlobal || getMaxBookableQuantity() <= 0 && !editingReservationId}
                    />
                    {bookingQuantity > getMaxBookableQuantity() && <p className="text-xs text-red-500">Quantity exceeds available units ({getMaxBookableQuantity()}).</p>}
                    {!editingReservationId && getMaxBookableQuantity() <= 0 && <p className="text-xs text-red-500">No units available to book.</p>}
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

      {multiBookTargetItem && onConfirmMultiBookDaily && (
        <Dialog open={multiBookModalOpen} onOpenChange={setMultiBookModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">Book Multiple Periods for {multiBookTargetItem.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <p className="text-sm">You are booking <strong>{multiBookSelectedPeriodsForItem.length}</strong> period(s) on <strong>{format(selectedDate, 'MMM dd, yyyy')}</strong> for <strong>{itemType === 'device' ? `${(multiBookTargetItem as Device).roomName || 'N/A'} - ` : ''}{multiBookTargetItem.name}</strong>.</p>
              <ScrollArea className="h-24 border rounded-md p-2 text-sm">
                <ul>
                  {multiBookSelectedPeriodsForItem.map(period => (
                    <li key={period.name}>
                      {period.name} ({period.label})
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              
              {itemType === 'device' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="multi-daily-booking-quantity" className="font-medium">Quantity to Book (per period):</Label>
                    <Input
                      id="multi-daily-booking-quantity"
                      type="number"
                      value={multiBookQuantity}
                      onChange={(e) => setMultiBookQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      min="1"
                      max={maxQuantityForMultiBookDevice}
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal || maxQuantityForMultiBookDevice === 0}
                    />
                    {multiBookQuantity > maxQuantityForMultiBookDevice && <p className="text-xs text-red-500">Max available quantity across selected slots is {maxQuantityForMultiBookDevice}.</p>}
                    {maxQuantityForMultiBookDevice === 0 && <p className="text-xs text-red-500">No units consistently available across all selected slots.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Purpose (select all that apply):</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {DEVICE_PURPOSE_OPTIONS.map((purposeOpt) => (
                          <div key={`multi-daily-${purposeOpt}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`multi-daily-purpose-${purposeOpt.replace(/\s+/g, '-')}`}
                              checked={multiBookPurposes.includes(purposeOpt)}
                              onCheckedChange={() => handleMultiBookDevicePurposeChange(purposeOpt)}
                              disabled={isSlotProcessing || isProcessingGlobal}
                            />
                            <Label htmlFor={`multi-daily-purpose-${purposeOpt.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">
                              {purposeOpt}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="multi-daily-booking-notes" className="font-medium">Additional Notes (optional):</Label>
                    <Input
                      id="multi-daily-booking-notes"
                      value={multiBookNotes}
                      onChange={(e) => setMultiBookNotes(e.target.value)}
                      placeholder="e.g., Specific software needed"
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal}
                    />
                  </div>
                </>
              )}
              {itemType === 'room' && (
                 <div className="space-y-1.5">
                    <Label htmlFor="multi-room-purpose-daily" className="font-medium">Purpose for all selected periods:</Label>
                    <Input
                      id="multi-room-purpose-daily"
                      value={multiBookRoomPurpose}
                      onChange={(e) => setMultiBookRoomPurpose(e.target.value)}
                      placeholder="e.g., Subject Department Meetings"
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal}
                    />
                </div>
              )}
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild><Button variant="outline" disabled={isSlotProcessing || isProcessingGlobal}>Cancel</Button></DialogClose>
              <Button
                onClick={confirmMultiBookDaily}
                disabled={isMultiBookConfirmDisabled()}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {(isSlotProcessing || isProcessingGlobal) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Multi-Booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

