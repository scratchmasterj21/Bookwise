"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon, ListPlus, XSquare, CheckSquare } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DEVICE_TYPES_WITH_ICONS, DEVICE_PURPOSE_OPTIONS } from '@/lib/constants';
import { Switch } from '../ui/switch';

const ALL_ITEMS_ID = "---all---";

interface BookingEntry {
  reservationId: string;
  bookedBy?: string;
  bookedQuantity: number;
  isCurrentUserBooking: boolean;
  devicePurposes?: string[];
  notes?: string;
  purpose?: string; // For rooms
  itemName?: string;
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'partially-booked' | 'all-booked' | 'past-available' | 'past-booked' | 'past-booked-all-view' | 'insufficient-quantity';
  isPast: boolean;
  displayText?: string;
  bookingEntries?: BookingEntry[];
  mainReservation?: Reservation;
  bookedUnits?: number;
  itemTotalQuantity?: number;
  availableQuantity?: number;
  totalAvailableUnits?: number;
  totalPotentialUnits?: number;
}

type Item = Room | Device;

interface ItemStyling {
  borderClass: string;
  textClass: string;
  icon?: React.ElementType;
  backgroundClass?: string;
}

interface SelectedMultiSlotInfo {
  day: Date;
  period: TimePeriod;
  availableInSlot: number;
}

interface WeeklyBookingCalendarProps {
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
  onConfirmMultiBook?: (details: {
    itemId: string;
    itemName: string;
    slots: { day: Date; period: TimePeriod }[];
    quantity: number;
    devicePurposes: string[];
    notes: string;
  }) => Promise<void>;
  periods: TimePeriod[];
  initialDate?: Date;
  isProcessingGlobal?: boolean;
  itemDisplayName?: string;
  bookingModalPurposeLabel?: string;
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

const getIconForItemType = (itemTypeProp: 'room' | 'device', deviceType?: DeviceType): React.ElementType | undefined => {
  if (itemTypeProp === 'device') {
    const typeKey = deviceType || 'Other';
    const iconName = DEVICE_TYPES_WITH_ICONS[typeKey] || 'Package';
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


export default function WeeklyBookingCalendar({
  items,
  itemType,
  reservations,
  onBookSlot,
  onUpdateSlot,
  onDeleteSlot,
  onConfirmMultiBook,
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
  
  const [isMultiPeriodMode, setIsMultiPeriodMode] = useState(false);
  const [selectedMultiSlots, setSelectedMultiSlots] = useState<Map<string, SelectedMultiSlotInfo>>(new Map());
  const [multiBookModalOpen, setMultiBookModalOpen] = useState(false);
  const [multiBookQuantity, setMultiBookQuantity] = useState<number>(1);
  const [multiBookPurposes, setMultiBookPurposes] = useState<string[]>([]);
  const [multiBookNotes, setMultiBookNotes] = useState('');


  const [bookingPurpose, setBookingPurpose] = useState('');
  const [selectedDevicePurposes, setSelectedDevicePurposes] = useState<string[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingQuantity, setBookingQuantity] = useState<number>(1);

  const [modalSelectedItemIdForBooking, setModalSelectedItemIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const currentSelectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  useEffect(() => {
    if (!bookingModalOpen) {
        setModalSelectedItemIdForBooking(undefined);
        setEditingReservationId(null);
        setBookingPurpose('');
        setSelectedDevicePurposes([]);
        setBookingNotes('');
        setBookingQuantity(1);
    }
  }, [bookingModalOpen]);

  useEffect(() => {
    if (selectedItemId === ALL_ITEMS_ID || !currentSelectedItem || itemType !== 'device') {
      setIsMultiPeriodMode(false);
    }
    if (!isMultiPeriodMode) {
        setSelectedMultiSlots(new Map());
    }
  }, [selectedItemId, currentSelectedItem, itemType, isMultiPeriodMode]);


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

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => addDays(currentDate, i));
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getReservationsForSlot = useCallback((day: Date, period: TimePeriod, itemIdForFilter?: string): Reservation[] => {
    const periodStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const periodEndDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.end.split(':')[0])), parseInt(period.end.split(':')[1])),0),0);

    return reservations.filter(res => {
      if (res.itemType !== itemType) return false;
      if (itemIdForFilter && res.itemId !== itemIdForFilter) return false;

      const reservationStart = new Date(res.startTime);
      const reservationEnd = new Date(res.endTime);
      return reservationStart < periodEndDateTime && reservationEnd > periodStartDateTime && res.status !== 'cancelled' && res.status !== 'rejected';
    });
  }, [reservations, itemType]);

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
      if (itemType === 'room') {
        setBookingPurpose(existingReservation.purpose || '');
      } else {
        setSelectedDevicePurposes(existingReservation.devicePurposes || []);
        setBookingNotes(existingReservation.notes || '');
        setBookingQuantity(existingReservation.bookedQuantity || 1);
      }
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
      const details: any = {
        itemId: itemToBookOrUpdate.id,
        itemName: itemToBookOrUpdate.name,
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
  }

  const getCellDisplayData = useCallback((day: Date, period: TimePeriod): CellDisplayInfo => {
    const slotStartDateTime = setMilliseconds(setSeconds(setMinutes(setHours(day, parseInt(period.start.split(':')[0])), parseInt(period.start.split(':')[1])),0),0);
    const isPast = isBefore(new Date(), slotStartDateTime) && !isSameDay(new Date(), slotStartDateTime) ? false : isBefore(slotStartDateTime, new Date());

    if (selectedItemId === ALL_ITEMS_ID) {
        const allSlotReservations = getReservationsForSlot(day, period);
        if (itemType === 'room') {
            const bookedItemCount = new Set(allSlotReservations.map(res => res.itemId)).size;
            const totalItemUnits = items.length;
            if (isPast) {
                if (bookedItemCount > 0) return { status: 'past-booked-all-view', isPast: true, displayText: `${bookedItemCount} ${itemDisplayName}(s) Booked` };
                return { status: 'past-available', isPast: true, displayText: "" };
            }
            if (totalItemUnits > 0 && bookedItemCount >= totalItemUnits) {
                return { status: 'all-booked', isPast: false, displayText: `All ${itemDisplayName}s Booked` };
            }
            if (bookedItemCount > 0) {
                 return { status: 'partially-booked', isPast: false, displayText: `${bookedItemCount}/${totalItemUnits} Booked` };
            }
            return { status: 'available', isPast: false, displayText: "Available" };
        } else { 
            let totalPotentialUnits = 0;
            let totalBookedUnits = 0;
            items.forEach(item => {
                const device = item as Device;
                totalPotentialUnits += device.quantity;
                const deviceReservations = allSlotReservations.filter(r => r.itemId === device.id);
                totalBookedUnits += deviceReservations.reduce((sum, res) => sum + (res.bookedQuantity || 1), 0);
            });
            const totalAvailableUnits = totalPotentialUnits - totalBookedUnits;

            if (isPast) {
                if (totalBookedUnits > 0) return { status: 'past-booked-all-view', isPast: true, displayText: `${totalBookedUnits} Unit(s) Booked`, totalAvailableUnits: totalAvailableUnits, totalPotentialUnits: totalPotentialUnits };
                return { status: 'past-available', isPast: true, displayText: "", totalAvailableUnits: totalAvailableUnits, totalPotentialUnits: totalPotentialUnits };
            }
            if (totalAvailableUnits <= 0 && totalPotentialUnits > 0) {
                return { status: 'all-booked', isPast: false, displayText: "All Device Units Booked", totalAvailableUnits: totalAvailableUnits, totalPotentialUnits: totalPotentialUnits };
            }
            if (totalBookedUnits > 0) {
                 return { status: 'partially-booked', isPast: false, displayText: `${totalAvailableUnits} of ${totalPotentialUnits} Units Available`, totalAvailableUnits: totalAvailableUnits, totalPotentialUnits: totalPotentialUnits };
            }
            return { status: 'available', isPast: false, displayText: totalPotentialUnits > 0 ? `${totalPotentialUnits} Units Available` : "No Devices", totalAvailableUnits: totalAvailableUnits, totalPotentialUnits: totalPotentialUnits };
        }
    }

    const currentItem = items.find(i => i.id === selectedItemId);
    if (!currentItem) return { status: 'past-available', isPast: true, displayText: ""}; 

    const slotReservations = getReservationsForSlot(day, period, selectedItemId);
    const bookingEntries: BookingEntry[] = slotReservations.map(res => ({
        reservationId: res.id,
        bookedBy: res.bookedBy || res.userName,
        bookedQuantity: res.bookedQuantity || 1,
        isCurrentUserBooking: res.userId === user?.uid,
        devicePurposes: res.devicePurposes,
        notes: res.notes,
        purpose: res.purpose, 
        itemName: res.itemName,
    }));

    const totalBookedUnits = bookingEntries.reduce((sum, entry) => sum + entry.bookedQuantity, 0);
    const itemTotalQuantity = itemType === 'device' ? (currentItem as Device).quantity : 1;
    const availableQuantity = itemTotalQuantity - totalBookedUnits;
    const mainUserReservation = bookingEntries.find(entry => entry.isCurrentUserBooking) ? slotReservations.find(r => r.userId === user?.uid) : undefined;


    if (isPast) {
        if (bookingEntries.length > 0) return { status: 'past-booked', isPast: true, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
        return { status: 'past-available', isPast: true, itemName: currentItem.name, displayText: "" , itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits};
    }

    if (availableQuantity <= 0) {
        return { status: 'all-booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
    }
    if (bookingEntries.length > 0) {
        return { status: 'booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainUserReservation, bookedUnits: totalBookedUnits };
    }
    return { status: 'available', isPast: false, itemName: currentItem.name, displayText: `Available (${itemTotalQuantity})`, itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits };
  }, [selectedItemId, getReservationsForSlot, itemType, items, user]);

  const getCellClasses = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    let baseClasses = "p-0 border align-top h-[75px] relative group/cell";

    if (isToday(day) && cellData.status !== 'past-available' && cellData.status !== 'past-booked' && cellData.status !== 'past-booked-all-view') {
        baseClasses = cn(baseClasses, "bg-primary/5");
    }

    const currentItemForStyling = items.find(i => i.id === selectedItemId);
    const itemStyling = currentItemForStyling ? getItemStyling(currentItemForStyling, itemType) : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());

    if (cellData.isPast) {
        if (cellData.status === 'past-booked' || cellData.status === 'past-booked-all-view') {
            baseClasses = cn(baseClasses, `bg-slate-100 ${itemStyling.borderClass} border-dashed opacity-60 cursor-default`);
        } else {
            baseClasses = cn(baseClasses, "bg-slate-50 border-slate-200 border-dashed cursor-default");
        }
    } else { 
        const canInteract = !isMultiPeriodMode || (isMultiPeriodMode && itemType === 'device' && currentSelectedItem && cellData.availableQuantity && cellData.availableQuantity > 0);
        if (cellData.status === 'booked' && selectedItemId !== ALL_ITEMS_ID) {
            const mainUserRes = cellData.bookingEntries?.find(be => be.isCurrentUserBooking);
            const backgroundClass = mainUserRes ? 'bg-green-50' : itemStyling.backgroundClass;
            baseClasses = cn(baseClasses, `${backgroundClass} ${itemStyling.borderClass} border-2`, canInteract ? "cursor-pointer" : "cursor-default");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 transition-colors duration-150", canInteract ? "cursor-pointer" : "cursor-default");
        } else if (cellData.status === 'all-booked' && selectedItemId !== ALL_ITEMS_ID) {
             baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-300", itemStyling.borderClass, cellData.mainReservation && canInteract ? "cursor-pointer" : "cursor-not-allowed");
        } else if (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID) {
             baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-200", canInteract ? "cursor-pointer" : "cursor-default");
        } else if (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) {
            baseClasses = cn(baseClasses, "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700 transition-colors duration-150", canInteract ? "cursor-pointer" : "cursor-default");
        } else {
            baseClasses = cn(baseClasses, "bg-card hover:bg-muted border-slate-200", canInteract ? "cursor-pointer" : "cursor-default");
             if (selectedItemId === ALL_ITEMS_ID && cellData.status === 'available') {
                baseClasses = cn(baseClasses, canInteract ? "cursor-pointer" : "cursor-default");
            }
        }
    }
    return baseClasses;
  };
  
  const handleCellClick = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    if (isProcessingGlobal || isSlotProcessing) return;

    if (isMultiPeriodMode) {
      if (itemType === 'device' && currentSelectedItem && !cellData.isPast && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0) {
        const slotKey = `${day.toISOString()}-${period.name}`;
        const newSelectedSlots = new Map(selectedMultiSlots);
        if (newSelectedSlots.has(slotKey)) {
          newSelectedSlots.delete(slotKey);
        } else {
          newSelectedSlots.set(slotKey, { day, period, availableInSlot: cellData.availableQuantity });
        }
        setSelectedMultiSlots(newSelectedSlots);
      } else if (cellData.isPast || (itemType === 'device' && currentSelectedItem && (cellData.availableQuantity === undefined || cellData.availableQuantity <=0))) {
        toast({ title: "Cannot Select Slot", description: "This slot is unavailable or in the past.", variant: "destructive" });
      }
      return; 
    }

    if (cellData.isPast) {
      if(cellData.bookingEntries && cellData.bookingEntries.length > 0) {
        toast({
            title: `Past Booking (${cellData.bookingEntries[0].itemName || itemDisplayName})`,
            description: cellData.bookingEntries.map(be => `${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})`).join(', ')
        });
      } else if (cellData.status === 'past-booked-all-view') {
         toast({ title: "Past Bookings", description: cellData.displayText });
      } else {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }
    
    const slotReservations = getReservationsForSlot(day, period, selectedItemId !== ALL_ITEMS_ID ? selectedItemId : undefined);

    if (cellData.mainReservation && (cellData.status === 'booked' || cellData.status === 'all-booked')) {
        if (isAdmin || cellData.mainReservation.userId === user?.uid) {
             handleSlotAction(day, period, 'edit', cellData.mainReservation);
        } else {
            const bookingDetailsString = cellData.bookingEntries?.map(be => `${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})${be.devicePurposes ? ` - ${be.devicePurposes.join('/')}` : be.purpose ? ` - ${be.purpose}` : ''}`).join('; ');
            toast({ title: "Booking Details", description: `${cellData.bookingEntries && cellData.bookingEntries[0].itemName}: ${bookingDetailsString}` });
        }
    } else if (cellData.status === 'available' || (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) || (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID && itemType === 'device' && cellData.totalAvailableUnits !== undefined && cellData.totalAvailableUnits > 0) || (cellData.status === 'available' && selectedItemId === ALL_ITEMS_ID && itemType === 'device' && cellData.totalPotentialUnits !== undefined && cellData.totalPotentialUnits > 0 )) {
        handleSlotAction(day, period, 'book');
    } else if ((cellData.status === 'all-booked' && selectedItemId !== ALL_ITEMS_ID && !(cellData.mainReservation && (isAdmin || cellData.mainReservation.userId === user?.uid)))) {
         const bookingDetailsString = cellData.bookingEntries?.map(be => `${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})`).join('; ');
         const itemNameForToast = items.find(i=>i.id === selectedItemId)?.name;
         toast({ title: "Fully Booked", description: `${itemNameForToast}: ${bookingDetailsString}`, variant: "default" });
    } else if (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID && itemType === 'room') {
        toast({ title: `No ${itemDisplayName}s Available`, description: `All ${itemDisplayName.toLowerCase()}s are booked for this slot.`, variant: "default" });
    }
  };
  
  const getMaxBookableQuantity = () => {
    if (!currentBookingSlot) return 1;
    const { day, period, item: modalItem, existingReservation } = currentBookingSlot;
    const itemForCalc = modalItem || (modalSelectedItemIdForBooking ? items.find(i => i.id === modalSelectedItemIdForBooking) : null) || currentSelectedItem;

    if (itemType === 'device' && itemForCalc) {
      const device = itemForCalc as Device;
      const reservationsInSlot = getReservationsForSlot(day, period, device.id);
      let totalBookedByOthers = 0;
      reservationsInSlot.forEach(res => {
        if (res.id !== existingReservation?.id) {
          totalBookedByOthers += (res.bookedQuantity || 1);
        }
      });
      const maxQty = device.quantity - totalBookedByOthers;
      return Math.max(0, maxQty); 
    }
    return 1; 
  };

  const isBookingButtonDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal) return true;
    
    const itemForModal = modalSelectedItemIdForBooking ? items.find(i => i.id === modalSelectedItemIdForBooking) : currentBookingSlot?.item;

    if (selectedItemId === ALL_ITEMS_ID && !editingReservationId && !itemForModal) return true;

    if (itemType === 'room' && !bookingPurpose.trim()) return true;
    if (itemType === 'device') {
      if (selectedDevicePurposes.length === 0) return true;
      if (bookingQuantity < 1) return true; 
      
      const maxQty = getMaxBookableQuantity();
      if (bookingQuantity > maxQty) return true;
      if (!editingReservationId && maxQty === 0) return true; 
    }
    return false;
  };

  const handleOpenMultiBookModal = () => {
    if (!currentSelectedItem || selectedMultiSlots.size === 0) return;
    setMultiBookQuantity(1);
    setMultiBookPurposes([]);
    setMultiBookNotes('');
    setMultiBookModalOpen(true);
  };
  
  const maxQuantityForMultiBook = useMemo(() => {
    if (!isMultiPeriodMode || selectedMultiSlots.size === 0 || !currentSelectedItem || itemType !== 'device') {
      return 1;
    }
    let minAvailable = Infinity;
    selectedMultiSlots.forEach(slotInfo => {
      minAvailable = Math.min(minAvailable, slotInfo.availableInSlot);
    });
    return minAvailable === Infinity ? 0 : minAvailable;
  }, [isMultiPeriodMode, selectedMultiSlots, currentSelectedItem, itemType]);


  const confirmMultiBook = async () => {
     if (!onConfirmMultiBook || !currentSelectedItem || selectedMultiSlots.size === 0 || isSlotProcessing) return;
     
     if (itemType === 'device' && multiBookPurposes.length === 0) {
       toast({ title: "Purpose Required", description: "Please select at least one purpose for the device booking.", variant: "destructive" });
       return;
     }
     if (itemType === 'device' && multiBookQuantity < 1) {
       toast({ title: "Invalid Quantity", description: "Quantity must be at least 1.", variant: "destructive" });
       return;
     }
      if (itemType === 'device' && multiBookQuantity > maxQuantityForMultiBook) {
        toast({ title: "Quantity Exceeds Availability", description: `Maximum bookable quantity across selected slots is ${maxQuantityForMultiBook}.`, variant: "destructive" });
        return;
      }

     setIsSlotProcessing(true);
     try {
       const slotsToBook = Array.from(selectedMultiSlots.values()).map(s => ({ day: s.day, period: s.period }));
       await onConfirmMultiBook({
         itemId: currentSelectedItem.id,
         itemName: currentSelectedItem.name,
         slots: slotsToBook,
         quantity: multiBookQuantity,
         devicePurposes: multiBookPurposes,
         notes: multiBookNotes,
       });
       setSelectedMultiSlots(new Map()); 
     } catch (error) {
        // error should be handled by parent
     } finally {
       setIsSlotProcessing(false);
       setMultiBookModalOpen(false);
     }
  };

  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 pb-4 pt-4 px-4 border-b bg-primary/5">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={isProcessingGlobal || isSlotProcessing || isMultiPeriodMode}>
            <SelectTrigger className="w-full md:w-[320px] bg-background shadow-sm">
              <SelectValue placeholder={`Select a ${itemDisplayName.toLowerCase()} or View All`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_ID}>Show All {itemDisplayName}s</SelectItem>
              {items.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    {itemType === 'device' && getIconForItemType(itemType, (item as Device).type) &&
                        React.createElement(getIconForItemType(itemType, (item as Device).type)!, {className: "h-4 w-4 text-muted-foreground"})}
                    {itemType === 'device' ? `${(item as Device).roomName || 'N/A'} - ${item.name} (Qty: ${(item as Device).quantity})`
                      : `${item.name} (${(item as Room).buildingName || 'N/A'})`
                    }
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           {itemType === 'device' && selectedItemId !== ALL_ITEMS_ID && currentSelectedItem && onConfirmMultiBook && (
            <div className="flex items-center space-x-2 ml-2">
              <Switch
                id="multi-period-mode"
                checked={isMultiPeriodMode}
                onCheckedChange={(checked) => {
                  setIsMultiPeriodMode(checked);
                  if (!checked) setSelectedMultiSlots(new Map()); 
                }}
                disabled={isProcessingGlobal || isSlotProcessing}
              />
              <Label htmlFor="multi-period-mode" className="text-sm text-foreground whitespace-nowrap">Select Multiple Periods</Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
         {isMultiPeriodMode && selectedMultiSlots.size > 0 && (
            <Button 
              onClick={handleOpenMultiBookModal} 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white mr-3"
              disabled={isSlotProcessing || isProcessingGlobal}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Book {selectedMultiSlots.size} Selected Period{selectedMultiSlots.size > 1 ? 's' : ''}
            </Button>
          )}
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
                       <div className="text-sm font-semibold text-foreground">{period.name}</div>
                       <div className="text-xs text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const slotKey = `${day.toISOString()}-${period.name}`;
                      const cellData = getCellDisplayData(day, period);
                      const currentItemStyling = items.find(i => i.id === selectedItemId) 
                                                ? getItemStyling(items.find(i => i.id === selectedItemId)!, itemType)
                                                : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());

                      const showActions = cellData.mainReservation && (isAdmin || cellData.mainReservation.userId === user?.uid) && !cellData.isPast && selectedItemId !== ALL_ITEMS_ID && hoveredSlot === slotKey && !isMultiPeriodMode;
                      const isSlotBookableForMultiSelect = itemType === 'device' && currentSelectedItem && !cellData.isPast && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0;


                      return (
                        <td
                          key={slotKey}
                          className={cn(getCellClasses(day, period), 'align-top')}
                          onClick={() => handleCellClick(day, period)}
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
                                        newSelectedSlots.set(slotKey, { day, period, availableInSlot: cellData.availableQuantity || 0 });
                                      }
                                      setSelectedMultiSlots(newSelectedSlots);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()} 
                                  aria-label={`Select slot ${format(day, 'MMM dd')} ${period.name}`}
                                />
                              </div>
                            )}
                            { (cellData.status === 'booked' || cellData.status === 'all-booked') && selectedItemId !== ALL_ITEMS_ID && cellData.bookingEntries && cellData.bookingEntries.length > 0 ? (
                               <div className={cn("flex flex-col w-full h-full space-y-0.5 text-[10px] leading-tight", cellData.isPast ? "opacity-60" : "", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                  <span className={cn("block font-semibold", currentItemStyling.textClass)}>
                                    {currentSelectedItem?.name}
                                  </span>
                                  <span className="font-medium text-muted-foreground">Booked by:</span>
                                  <ScrollArea className="h-[calc(100%-30px)] pr-1"> 
                                    <ul className="space-y-0.5">
                                      {cellData.bookingEntries.map(entry => (
                                        <li key={entry.reservationId} className={cn(entry.isCurrentUserBooking && "font-semibold text-primary")}>
                                          {getLastName(entry.bookedBy)} (Qty: {entry.bookedQuantity})
                                          {itemType === 'room' && entry.purpose && <span className="block text-slate-600 text-[9px] pl-2">↳ {entry.purpose}</span>}
                                          {itemType === 'device' && entry.devicePurposes && entry.devicePurposes.length > 0 && <span className="block text-slate-600 text-[9px] pl-2">↳ {entry.devicePurposes.join(', ')}</span>}
                                          {itemType === 'device' && entry.notes && <span className="block text-slate-500 text-[9px] pl-2">↳ Notes: {entry.notes}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </ScrollArea>
                                   {!cellData.isPast && (
                                      <div className="mt-auto pt-0.5 text-[10px]">
                                          {cellData.availableQuantity !== undefined && cellData.availableQuantity > 0 && <span className="text-green-600 font-medium">({cellData.availableQuantity} remaining)</span>}
                                          {cellData.availableQuantity !== undefined && cellData.availableQuantity <= 0 && <span className="text-red-600 font-medium">(Fully Booked)</span>}
                                      </div>
                                  )}
                              </div>
                            ) : (cellData.status === 'available' && !cellData.isPast) ? (
                                <div className={cn("flex-grow flex flex-col items-center justify-center", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                    <span className={cn("font-medium text-xs", selectedItemId !== ALL_ITEMS_ID && cellData.displayText !== 'No Devices' && itemType === 'room' ? "text-primary" : (selectedItemId !== ALL_ITEMS_ID && itemType === 'device' ? "text-primary" : "text-muted-foreground"))}>
                                      {cellData.displayText}
                                    </span>
                                </div>
                            ) : (cellData.status === 'partially-booked' || cellData.status === 'all-booked' ) && !cellData.isPast && selectedItemId === ALL_ITEMS_ID ? ( 
                                <div className="flex-grow flex flex-col items-center justify-center">
                                     <span className={cn(
                                      "text-xs font-medium",
                                      cellData.status === 'partially-booked' ? "text-sky-700" :
                                      cellData.status === 'all-booked' ? "text-red-700" :
                                      "text-muted-foreground"
                                    )}>
                                        {cellData.displayText}
                                    </span>
                                </div>
                            ) : (cellData.isPast && cellData.status === 'past-booked' && cellData.bookingEntries && cellData.bookingEntries.length > 0 ) ? (
                                <div className={cn("flex flex-col w-full h-full space-y-0.5 text-[10px] leading-tight opacity-60")}>
                                     <span className={cn("block font-semibold", currentItemStyling.textClass)}>{cellData.bookingEntries[0].itemName}</span>
                                     <span className="font-medium text-muted-foreground">Booked by:</span>
                                     <ul className="space-y-0.5">
                                      {cellData.bookingEntries.map(entry => (
                                        <li key={entry.reservationId}>
                                          {getLastName(entry.bookedBy)} (Qty: {entry.bookedQuantity})
                                        </li>
                                      ))}
                                    </ul>
                                </div>
                            ) : (cellData.isPast && (cellData.status === 'past-available' || !cellData.displayText)) ? (
                                 <div className="flex-grow flex flex-col items-center justify-center">  </div>
                            ) : (cellData.displayText &&
                                 <div className={cn("flex-grow flex flex-col items-center justify-center", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
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
                    onValueChange={(value) => { setModalSelectedItemIdForBooking(value); setBookingQuantity(1); }}
                    required
                  >
                    <SelectTrigger id="modal-item-select" className="w-full">
                      <SelectValue placeholder={`Choose an available ${itemDisplayName.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter(item => {
                          const specificItemReservations = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          const bookedUnitsForItem = specificItemReservations.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                          const itemTotalQty = itemType === 'device' ? (item as Device).quantity : 1;
                          return itemTotalQty - bookedUnitsForItem > 0;
                        })
                        .map(item => {
                           let availableUnitsText = "";
                           if(itemType === 'device') {
                                const slotRes = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                                const totalBooked = slotRes.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                                const available = (item as Device).quantity - totalBooked;
                                availableUnitsText = ` (Available: ${available})`;
                           }
                           return (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex items-center gap-2">
                                  {itemType === 'device' && getIconForItemType(itemType, (item as Device).type) &&
                                  React.createElement(getIconForItemType(itemType, (item as Device).type)!, {className: "h-4 w-4 text-muted-foreground"})}
                                  {itemType === 'device' ? `${(item as Device).roomName || 'N/A'} - ${item.name}${availableUnitsText}`
                                    : `${item.name} (${(item as Room).buildingName || 'N/A'})`
                                  }
                              </div>
                            </SelectItem>
                           );
                        })}
                       {items.filter(item => {
                          const specificItemReservations = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          const bookedUnitsForItem = specificItemReservations.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                          const itemTotalQty = itemType === 'device' ? (item as Device).quantity : 1;
                          return itemTotalQty - bookedUnitsForItem > 0;
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
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {DEVICE_PURPOSE_OPTIONS.map((purposeOpt) => (
                          <div key={purposeOpt} className="flex items-center space-x-2">
                            <Checkbox
                              id={`purpose-${purposeOpt.replace(/\s+/g, '-')}`}
                              checked={selectedDevicePurposes.includes(purposeOpt)}
                              onCheckedChange={() => handleDevicePurposeChange(purposeOpt)}
                              disabled={isSlotProcessing || isProcessingGlobal}
                            />
                            <Label htmlFor={`purpose-${purposeOpt.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">
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
              {editingReservationId ? `Update Booking` : `Confirm Booking`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {itemType === 'device' && currentSelectedItem && (
        <Dialog open={multiBookModalOpen} onOpenChange={setMultiBookModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">Book Multiple Periods for {currentSelectedItem.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <p className="text-sm">You are booking <strong>{selectedMultiSlots.size}</strong> period(s) for <strong>{(currentSelectedItem as Device).roomName || 'N/A'} - {currentSelectedItem.name}</strong>.</p>
              <ScrollArea className="h-24 border rounded-md p-2 text-sm">
                <ul>
                  {Array.from(selectedMultiSlots.values()).map(slot => (
                    <li key={`${slot.day.toISOString()}-${slot.period.name}`}>
                      {format(slot.day, 'EEE, MMM dd')} - {slot.period.name} ({slot.period.label})
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              
              <div className="space-y-1.5">
                <Label htmlFor="multi-booking-quantity" className="font-medium">Quantity to Book (per period):</Label>
                <Input
                  id="multi-booking-quantity"
                  type="number"
                  value={multiBookQuantity}
                  onChange={(e) => setMultiBookQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min="1"
                  max={maxQuantityForMultiBook}
                  className="text-sm"
                  disabled={isSlotProcessing || isProcessingGlobal}
                />
                {multiBookQuantity > maxQuantityForMultiBook && <p className="text-xs text-red-500">Max available quantity across selected slots is {maxQuantityForMultiBook}.</p>}
                 {maxQuantityForMultiBook === 0 && <p className="text-xs text-red-500">No units consistently available across all selected slots.</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Purpose (select all that apply):</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {DEVICE_PURPOSE_OPTIONS.map((purposeOpt) => (
                      <div key={`multi-${purposeOpt}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`multi-purpose-${purposeOpt.replace(/\s+/g, '-')}`}
                          checked={multiBookPurposes.includes(purposeOpt)}
                          onCheckedChange={() => handleMultiBookDevicePurposeChange(purposeOpt)}
                          disabled={isSlotProcessing || isProcessingGlobal}
                        />
                        <Label htmlFor={`multi-purpose-${purposeOpt.replace(/\s+/g, '-')}`} className="text-sm font-normal cursor-pointer">
                          {purposeOpt}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="multi-booking-notes" className="font-medium">Additional Notes (optional):</Label>
                <Input
                  id="multi-booking-notes"
                  value={multiBookNotes}
                  onChange={(e) => setMultiBookNotes(e.target.value)}
                  placeholder="e.g., Specific software needed"
                  className="text-sm"
                  disabled={isSlotProcessing || isProcessingGlobal}
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild><Button variant="outline" disabled={isSlotProcessing}>Cancel</Button></DialogClose>
              <Button
                onClick={confirmMultiBook}
                disabled={isSlotProcessing || isProcessingGlobal || selectedMultiSlots.size === 0 || multiBookPurposes.length === 0 || multiBookQuantity < 1 || multiBookQuantity > maxQuantityForMultiBook || maxQuantityForMultiBook === 0}
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
