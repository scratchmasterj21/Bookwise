
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon, CheckSquare } from 'lucide-react';
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
  purpose?: string;
  itemName?: string;
  itemId?: string;
  userId?: string;
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
  bookedItemCount?: number;
  totalItemUnits?: number;
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
    quantity?: number;
    devicePurposes?: string[];
    notes?: string;
    purpose?: string;
  }) => Promise<void>;
  periods: TimePeriod[];
  initialDate?: Date;
  isProcessingGlobal?: boolean;
  itemDisplayName?: string;
  bookingModalPurposeLabel?: string;
  key?: string | number;
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
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return fullName;
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
  const [multiBookRoomPurpose, setMultiBookRoomPurpose] = useState('');

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
    if (selectedItemId === ALL_ITEMS_ID ) {
      setIsMultiPeriodMode(false);
    }
    if (!isMultiPeriodMode) {
        setSelectedMultiSlots(new Map());
    }
  }, [selectedItemId, isMultiPeriodMode]);


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

  const handleSlotAction = (day: Date, period: TimePeriod, actionType: 'book' | 'edit', reservationToActOn?: Reservation) => {
    if (isProcessingGlobal || isSlotProcessing) return;
     if (!user) {
      toast({ title: "Authentication required", description: "Please log in.", variant: "destructive" });
      return;
    }

    let targetItem: Item | undefined | null = null;

    if (actionType === 'edit' && reservationToActOn) {
      targetItem = items.find(i => i.id === reservationToActOn.itemId);
       const canManageBooking = isAdmin || reservationToActOn.userId === user.uid;
       if (!canManageBooking) {
        toast({ title: "Permission Denied", description: "You cannot edit this booking.", variant: "destructive"});
        return;
      }
      setCurrentBookingSlot({ day, period, item: targetItem, existingReservation: reservationToActOn });
      if (itemType === 'room') {
        setBookingPurpose(reservationToActOn.purpose || '');
      } else {
        setSelectedDevicePurposes(reservationToActOn.devicePurposes || []);
        setBookingNotes(reservationToActOn.notes || '');
        setBookingQuantity(reservationToActOn.bookedQuantity || 1);
      }
      setEditingReservationId(reservationToActOn.id);
      setModalSelectedItemIdForBooking(reservationToActOn.itemId);
    } else if (actionType === 'book') {
        if (selectedItemId === ALL_ITEMS_ID) {
             setCurrentBookingSlot({ day, period, item: null });
             setModalSelectedItemIdForBooking(undefined);
        } else {
             targetItem = items.find(i => i.id === selectedItemId);
             setCurrentBookingSlot({ day, period, item: targetItem });
             setModalSelectedItemIdForBooking(targetItem?.id);
        }
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
    const { day, period } = currentBookingSlot;

    let finalItemId = editingReservationId ? currentBookingSlot.existingReservation?.itemId : modalSelectedItemIdForBooking;

    if(!finalItemId && !editingReservationId && selectedItemId !== ALL_ITEMS_ID) {
        finalItemId = selectedItemId;
    }

    if (!finalItemId) {
        toast({title: `${itemDisplayName} Selection Required`, description: `Please select a ${itemDisplayName.toLowerCase()} from the dropdown.`, variant: "destructive"});
        setIsSlotProcessing(false);
        return;
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
    let mainResForCell: Reservation | undefined = undefined;

    if (selectedItemId === ALL_ITEMS_ID) {
        const allSlotReservations = getReservationsForSlot(day, period);
        const bookingEntries: BookingEntry[] = allSlotReservations.map(res => ({
            reservationId: res.id,
            bookedBy: res.bookedBy || res.userName,
            bookedQuantity: res.bookedQuantity || (itemType === 'device' ? 1 : 0),
            isCurrentUserBooking: res.userId === user?.uid,
            devicePurposes: res.devicePurposes,
            notes: res.notes,
            purpose: res.purpose,
            itemName: res.itemName,
            itemId: res.itemId,
            userId: res.userId,
        }));

        if (itemType === 'room') {
            const bookedItemCount = new Set(allSlotReservations.map(res => res.itemId)).size;
            const totalItemUnits = items.length;
            let currentDisplayText = "";
             if (isPast) {
                if (bookedItemCount > 0) currentDisplayText = `${bookedItemCount} ${itemDisplayName}(s) Were Booked`;
             } else if (totalItemUnits > 0 && bookedItemCount === 0) {
                currentDisplayText = `Available`;
             } else if (totalItemUnits === 0) {
                currentDisplayText = `No ${itemDisplayName}s`;
             } else {
                 // For active 'partially-booked' or 'all-booked', clear display text
                 currentDisplayText = "";
             }

            if (isPast) {
                if (bookedItemCount > 0) return { status: 'past-booked-all-view', isPast: true, displayText: currentDisplayText, bookingEntries, totalItemUnits, bookedItemCount };
                return { status: 'past-available', isPast: true, displayText: currentDisplayText , totalItemUnits, bookedItemCount};
            }
            if (totalItemUnits > 0 && bookedItemCount >= totalItemUnits) {
                return { status: 'all-booked', isPast: false, displayText: currentDisplayText, bookingEntries, totalItemUnits, bookedItemCount };
            }
            if (bookedItemCount > 0) {
                 return { status: 'partially-booked', isPast: false, displayText: currentDisplayText, bookingEntries, totalItemUnits, bookedItemCount };
            }
            return { status: 'available', isPast: false, displayText: currentDisplayText, totalItemUnits, bookedItemCount };
        } else { // itemType is device (ALL_ITEMS_ID view)
            let totalPotentialUnits = 0;
            let totalBookedUnits = 0;
            items.forEach(item => {
                const device = item as Device;
                totalPotentialUnits += device.quantity;
                const deviceReservations = allSlotReservations.filter(r => r.itemId === device.id);
                totalBookedUnits += deviceReservations.reduce((sum, res) => sum + (res.bookedQuantity || 1), 0);
            });
            const totalAvailableUnits = totalPotentialUnits - totalBookedUnits;
            let currentDisplayText = "";
            if (isPast) {
                currentDisplayText = totalBookedUnits > 0 ? `${totalBookedUnits} Unit(s) Were Booked` : "";
            } else if (totalAvailableUnits <= 0 && totalPotentialUnits > 0) {
                currentDisplayText = "All Device Units Booked";
            } else if (totalBookedUnits > 0) {
                currentDisplayText = `${totalAvailableUnits} of ${totalPotentialUnits} Units Available`;
            } else {
                 currentDisplayText = totalPotentialUnits > 0 ? `${totalPotentialUnits} Units Available` : "No Devices";
            }

            if (isPast) {
                if (totalBookedUnits > 0) return { status: 'past-booked-all-view', isPast: true, displayText: currentDisplayText, totalAvailableUnits, totalPotentialUnits, bookingEntries };
                return { status: 'past-available', isPast: true, displayText: currentDisplayText, totalAvailableUnits, totalPotentialUnits };
            }
            if (totalAvailableUnits <= 0 && totalPotentialUnits > 0) {
                return { status: 'all-booked', isPast: false, displayText: currentDisplayText, totalAvailableUnits, totalPotentialUnits, bookingEntries };
            }
            if (totalBookedUnits > 0) {
                 return { status: 'partially-booked', isPast: false, displayText: currentDisplayText, totalAvailableUnits, totalPotentialUnits, bookingEntries };
            }
            return { status: 'available', isPast: false, displayText: currentDisplayText, totalAvailableUnits, totalPotentialUnits };
        }
    }

    // Logic for when a specific item is selected
    const currentItem = items.find(i => i.id === selectedItemId);
    if (!currentItem) return { status: 'past-available', isPast: true, displayText: ""};

    const slotReservations = getReservationsForSlot(day, period, selectedItemId);
    const bookingEntries: BookingEntry[] = slotReservations.map(res => ({
        reservationId: res.id,
        bookedBy: res.bookedBy || res.userName,
        bookedQuantity: res.bookedQuantity || (itemType === 'device' ? 1 : 0),
        isCurrentUserBooking: res.userId === user?.uid,
        devicePurposes: res.devicePurposes,
        notes: res.notes,
        purpose: res.purpose,
        itemName: res.itemName,
        itemId: res.itemId,
        userId: res.userId,
    }));

    const totalBookedUnits = bookingEntries.reduce((sum, entry) => sum + entry.bookedQuantity, 0);
    const itemTotalQuantity = itemType === 'device' ? (currentItem as Device).quantity : 1;
    const availableQuantity = itemTotalQuantity - totalBookedUnits;

    mainResForCell = slotReservations.find(r => r.userId === user?.uid && r.itemId === currentItem.id) || slotReservations.find(r => r.itemId === currentItem.id);


    if (isPast) {
        if (bookingEntries.length > 0) return { status: 'past-booked', isPast: true, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainResForCell, bookedUnits: totalBookedUnits };
        return { status: 'past-available', isPast: true, itemName: currentItem.name, displayText: "" , itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits};
    }

    if (availableQuantity <= 0 && itemType === 'device') {
        return { status: 'all-booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainResForCell, bookedUnits: totalBookedUnits };
    }
    if (bookingEntries.length > 0) {
        return { status: itemType === 'room' ? 'all-booked' : 'booked', isPast: false, bookingEntries, itemTotalQuantity, availableQuantity, mainReservation: mainResForCell, bookedUnits: totalBookedUnits };
    }
    return { status: 'available', isPast: false, itemName: currentItem.name, displayText: itemType === 'device' ? `Available (${itemTotalQuantity})` : "Available", itemTotalQuantity, availableQuantity, bookedUnits: totalBookedUnits };
  }, [selectedItemId, getReservationsForSlot, itemType, items, user, itemDisplayName]);

  const getCellClasses = (day: Date, period: TimePeriod) => {
    const cellData = getCellDisplayData(day, period);
    let baseClasses = "p-0 border align-top relative group/cell";

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
        const canInteract = !isMultiPeriodMode || (isMultiPeriodMode && currentSelectedItem && ( (itemType === 'device' && cellData.availableQuantity && cellData.availableQuantity > 0) || (itemType === 'room' && cellData.status === 'available')));

        if ((cellData.status === 'booked' || cellData.status === 'all-booked') && selectedItemId !== ALL_ITEMS_ID) {
            const mainUserRes = cellData.bookingEntries?.find(be => be.isCurrentUserBooking);
            const backgroundClass = mainUserRes ? 'bg-green-50' : (cellData.status === 'all-booked' ? 'bg-red-50' : itemStyling.backgroundClass);
            const borderColorClass = cellData.status === 'all-booked' ? 'border-red-300' : itemStyling.borderClass;
            baseClasses = cn(baseClasses, `${backgroundClass} ${borderColorClass} ${cellData.status === 'all-booked' ? '' : 'border-2'}`, (cellData.mainReservation || (isAdmin && cellData.bookingEntries && cellData.bookingEntries.length > 0) || (cellData.status === 'booked' && itemType === 'device' && cellData.availableQuantity && cellData.availableQuantity > 0)) && canInteract ? "cursor-pointer" : "cursor-not-allowed");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 transition-colors duration-150", canInteract ? "cursor-pointer" : "cursor-default");
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

    const currentUserReservationEntry = cellData.bookingEntries?.find(be => be.isCurrentUserBooking && be.itemId === selectedItemId);

    if (isMultiPeriodMode && currentSelectedItem) {
       const isRoomAvailableForMultiSelect = itemType === 'room' && !cellData.isPast && cellData.status === 'available';
       const isDeviceAvailableForMultiSelect = itemType === 'device' && !cellData.isPast && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0;

      if (isRoomAvailableForMultiSelect || isDeviceAvailableForMultiSelect) {
        const slotKey = `${day.toISOString()}-${period.name}`;
        const newSelectedSlots = new Map(selectedMultiSlots);
        if (newSelectedSlots.has(slotKey)) {
          newSelectedSlots.delete(slotKey);
        } else {
          newSelectedSlots.set(slotKey, { day, period, availableInSlot: itemType === 'device' ? (cellData.availableQuantity || 0) : 1 });
        }
        setSelectedMultiSlots(newSelectedSlots);
      } else if (cellData.isPast || ( (itemType === 'device' && (cellData.availableQuantity === undefined || cellData.availableQuantity <=0)) || (itemType === 'room' && cellData.status !== 'available'))) {
        toast({ title: "Cannot Select Slot", description: "This slot is unavailable or in the past.", variant: "destructive" });
      }
      return;
    }

    if (cellData.isPast) {
      if(cellData.bookingEntries && cellData.bookingEntries.length > 0 && (itemType === 'device' || (itemType === 'room' && selectedItemId !== ALL_ITEMS_ID))) {
        const description = itemType === 'device'
            ? cellData.bookingEntries.map(be => `<div>${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})</div>${be.devicePurposes && be.devicePurposes.length > 0 ? `<div>Purposes: ${be.devicePurposes.join(', ')}</div>` : ''}${be.notes ? `<div>Notes: ${be.notes}</div>`:''}`).join('<hr class="my-1">')
            : cellData.bookingEntries.map(be => `<div>${getLastName(be.bookedBy)}</div><div>${be.purpose}</div>`).join('<hr class="my-1">') ;
        toast({
            title: `Past Booking (${cellData.bookingEntries[0].itemName || itemDisplayName})`,
            description: <div dangerouslySetInnerHTML={{ __html: description }} />
        });
      } else if (cellData.status === 'past-booked-all-view') {
        const title = `Past Bookings for ${format(day, 'MMM dd')} - ${period.name}`;
        let descriptionContent = cellData.displayText || "Details not shown for past aggregated view.";
        if (cellData.bookingEntries && cellData.bookingEntries.length > 0) {
            descriptionContent = cellData.bookingEntries.map(be =>
                `<div><strong>${be.itemName}</strong>: ${getLastName(be.bookedBy)}${itemType === 'device' ? ` (Qty: ${be.bookedQuantity})` : ''}${be.purpose ? ` - ${be.purpose}` : ''}</div>`
            ).join('');
        }
         toast({ title, description: <div dangerouslySetInnerHTML={{ __html: descriptionContent }} /> });
      } else {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }

    // Device-specific interaction when a single device is selected
    if (itemType === 'device' && selectedItemId !== ALL_ITEMS_ID) {
        const currentDeviceItem = items.find(i => i.id === selectedItemId) as Device | undefined;
        if (!currentDeviceItem) return;

        if (currentUserReservationEntry) {
            const actualReservation = reservations.find(r => r.id === currentUserReservationEntry.reservationId);
            if (actualReservation && (isAdmin || actualReservation.userId === user?.uid)) {
                handleSlotAction(day, period, 'edit', actualReservation);
            } else if (actualReservation) { // User clicking someone else's booking
                 toast({ title: "Booking Details", description: `${getLastName(actualReservation.bookedBy)} (Qty: ${actualReservation.bookedQuantity})` });
            }
        } else if (cellData.availableQuantity !== undefined && cellData.availableQuantity > 0) {
            handleSlotAction(day, period, 'book');
        } else if (cellData.status === 'all-booked') {
            const bookingDetailsString = cellData.bookingEntries?.map(be => `<div>${getLastName(be.bookedBy)} (Qty: ${be.bookedQuantity})</div>`).join('');
            toast({ title: "Fully Booked", description: <div dangerouslySetInnerHTML={{ __html: `<div>${currentDeviceItem.name}:</div>${bookingDetailsString}` }} />, variant: "default" });
        }
        return;
    }

    // Fallback to general logic for rooms or "ALL_ITEMS_ID" view for devices
    let reservationToActOn = cellData.mainReservation || (cellData.bookingEntries && cellData.bookingEntries.length > 0 ? reservations.find(r => r.id === cellData.bookingEntries![0].reservationId && r.itemId === (selectedItemId === ALL_ITEMS_ID ? r.itemId : selectedItemId) ) : undefined);

    if (currentUserReservationEntry && itemType === 'room') { // User has a booking for this room
        reservationToActOn = reservations.find(r => r.id === currentUserReservationEntry.reservationId);
    }


    if (reservationToActOn && (isAdmin || reservationToActOn.userId === user?.uid)) {
        handleSlotAction(day, period, 'edit', reservationToActOn);
    } else if (cellData.status === 'available' ||
               (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) ||
               (selectedItemId === ALL_ITEMS_ID && itemType === 'device' && cellData.totalAvailableUnits !== undefined && cellData.totalAvailableUnits > 0)
    ) {
        handleSlotAction(day, period, 'book');
    } else if (reservationToActOn) { // Clicked someone else's booking / fully booked slot where user has no booking
        const details = cellData.bookingEntries?.filter(be => be.itemId === (selectedItemId === ALL_ITEMS_ID ? be.itemId : selectedItemId)).map(be =>
            `<div><strong>${be.itemName}</strong>: ${getLastName(be.bookedBy)}${itemType === 'device' ? ` (Qty: ${be.bookedQuantity})` : ''}${be.purpose ? ` - ${be.purpose}` : ''}</div>`
        ).join('');
        const title = cellData.status === 'all-booked' ? "Fully Booked" : "Booking Details";
        toast({ title, description: <div dangerouslySetInnerHTML={{ __html: details || "No details."}} /> });
    } else if (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID && itemType === 'room'){
         const details = cellData.bookingEntries?.map(be =>
            `<div><strong>${be.itemName}</strong>: ${getLastName(be.bookedBy)}${be.purpose ? ` - ${be.purpose}` : ''}</div>`
        ).join('');
        toast({ title: `All ${itemDisplayName}s Booked`, description: <div dangerouslySetInnerHTML={{ __html: details || ""}} /> });
    }
  };

  const getMaxBookableQuantity = () => {
    if (!currentBookingSlot) return 1;
    if (itemType !== 'device') return 1;

    const { day, period, existingReservation } = currentBookingSlot;

    let itemForCalc: Item | null | undefined = null;
    if (existingReservation) {
        itemForCalc = items.find(i => i.id === existingReservation.itemId);
    } else if (modalSelectedItemIdForBooking) {
        itemForCalc = items.find(i => i.id === modalSelectedItemIdForBooking);
    } else if (currentSelectedItem) {
        itemForCalc = currentSelectedItem;
    }

    if (itemForCalc) {
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

    let itemForModalId = editingReservationId ? currentBookingSlot?.existingReservation?.itemId : modalSelectedItemIdForBooking;
    if (!itemForModalId && !editingReservationId && selectedItemId !== ALL_ITEMS_ID) {
        itemForModalId = selectedItemId;
    }
    const itemForModal = items.find(i => i.id === itemForModalId);

    if (!itemForModal && !editingReservationId) return true;

    if (itemType === 'room') {
        if (!bookingPurpose.trim()) return true;
    } else {
      if (selectedDevicePurposes.length === 0) return true;
      if (bookingQuantity < 1) return true;

      const maxQty = getMaxBookableQuantity();
      if (bookingQuantity > maxQty) return true;
      if (!editingReservationId && maxQty === 0) return true;
    }
    return false;
  };

  const handleOpenMultiBookModal = () => {
    if (!currentSelectedItem || selectedMultiSlots.size === 0 || !onConfirmMultiBook) return;

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

     const multiBookDetails: any = {
        itemId: currentSelectedItem.id,
        itemName: currentSelectedItem.name,
        slots: Array.from(selectedMultiSlots.values()).map(s => ({ day: s.day, period: s.period })),
     };

     if (itemType === 'device') {
        if (multiBookPurposes.length === 0) {
          toast({ title: "Purpose Required", description: "Please select at least one purpose for the device booking.", variant: "destructive" });
          return;
        }
        if (multiBookQuantity < 1) {
          toast({ title: "Invalid Quantity", description: "Quantity must be at least 1.", variant: "destructive" });
          return;
        }
        if (multiBookQuantity > maxQuantityForMultiBookDevice) {
            toast({ title: "Quantity Exceeds Availability", description: `Maximum bookable quantity across selected slots is ${maxQuantityForMultiBookDevice}.`, variant: "destructive" });
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
       await onConfirmMultiBook(multiBookDetails);
       setSelectedMultiSlots(new Map());
       setIsMultiPeriodMode(false);
     } catch (error) {
        // error should be handled by parent
     } finally {
       setIsSlotProcessing(false);
       setMultiBookModalOpen(false);
     }
  };

  const isMultiBookConfirmDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal || !currentSelectedItem || selectedMultiSlots.size === 0) return true;
    if (itemType === 'device') {
      return multiBookPurposes.length === 0 || multiBookQuantity < 1 || multiBookQuantity > maxQuantityForMultiBookDevice || maxQuantityForMultiBookDevice === 0;
    } else {
      return !multiBookRoomPurpose.trim();
    }
  };


  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0 lg:space-x-4 pb-4 pt-4 px-4 border-b bg-primary/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={isProcessingGlobal || isSlotProcessing || (isMultiPeriodMode) }>
            <SelectTrigger className="w-full sm:w-[320px] bg-background shadow-sm text-sm">
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
           {selectedItemId !== ALL_ITEMS_ID && currentSelectedItem && onConfirmMultiBook && (
            <div className="flex items-center space-x-2 pt-2 sm:pt-0">
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

        <div className="flex flex-col items-stretch sm:items-center sm:flex-row gap-2 w-full lg:w-auto lg:justify-end">
         {isMultiPeriodMode && selectedMultiSlots.size > 0 && currentSelectedItem && onConfirmMultiBook && (
            <Button
              onClick={handleOpenMultiBookModal}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
              disabled={isSlotProcessing || isProcessingGlobal}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Book {selectedMultiSlots.size} Selected Period{selectedMultiSlots.size > 1 ? 's' : ''}
            </Button>
          )}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <h3 className="text-md sm:text-lg font-semibold text-foreground text-center md:text-left whitespace-nowrap">
                {format(currentDate, 'MMM dd')} - {format(addDays(currentDate, 4), 'MMM dd, yyyy')}
            </h3>
            <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Previous week" className="hover:bg-primary/10 h-8 w-8 sm:h-9 sm:w-9">
                    <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button variant="outline" onClick={handleToday} disabled={isProcessingGlobal || isSlotProcessing} className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">Today</Button>
                <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isProcessingGlobal || isSlotProcessing} aria-label="Next week" className="hover:bg-primary/10 h-8 w-8 sm:h-9 sm:w-9">
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length > 0 || selectedItemId === ALL_ITEMS_ID ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[1020px]">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 border-b border-r text-center sticky left-0 bg-muted z-20 font-semibold text-foreground align-middle h-16 min-w-[120px] sm:min-w-[150px]">Period</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={cn(
                        "p-2 border-b border-r text-center min-w-[150px] sm:min-w-[180px] font-semibold text-foreground align-middle h-16",
                        isToday(day) ? 'bg-primary/20 ' : ''
                      )}>
                      {format(day, 'EEE')} <br /> <span className="font-normal text-xs text-muted-foreground">{format(day, 'MMM dd')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => (
                  <tr key={period.name} className="even:bg-background odd:bg-muted/20">
                    <td className="p-2 border-r text-center sticky left-0 z-10 align-middle even:bg-background odd:bg-muted/20 min-w-[120px] sm:min-w-[150px]">
                       <div className="text-sm font-semibold text-foreground">{period.name}</div>
                       <div className="text-xs text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const slotKey = `${day.toISOString()}-${period.name}`;
                      const cellData = getCellDisplayData(day, period);
                      const currentItemForStyling = items.find(i => i.id === selectedItemId)
                                                ? getItemStyling(items.find(i => i.id === selectedItemId)!, itemType)
                                                : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());

                      const reservationForActions = cellData.bookingEntries?.find(be => isAdmin || be.isCurrentUserBooking && be.itemId === (selectedItemId === ALL_ITEMS_ID ? be.itemId : selectedItemId));
                      const fullReservationObjectForActions = reservationForActions ? reservations.find(r => r.id === reservationForActions.reservationId) : undefined;
                      const showActions = fullReservationObjectForActions && (isAdmin || fullReservationObjectForActions.userId === user?.uid) && !cellData.isPast && hoveredSlot === slotKey && !isMultiPeriodMode;


                      const isSlotBookableForMultiSelect = currentSelectedItem && !cellData.isPast && (
                          (itemType === 'device' && cellData.availableQuantity !== undefined && cellData.availableQuantity > 0) ||
                          (itemType === 'room' && cellData.status === 'available')
                      );

                      return (
                        <td
                          key={slotKey}
                          className={cn(getCellClasses(day, period), 'align-top')}
                          onClick={() => handleCellClick(day, period)}
                          onMouseEnter={() => setHoveredSlot(slotKey)}
                          onMouseLeave={() => setHoveredSlot(null)}
                        >
                           <div className="h-full w-full flex flex-col relative p-1.5 text-left">
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
                                        newSelectedSlots.set(slotKey, { day, period, availableInSlot: itemType === 'device' ? (cellData.availableQuantity || 0) : 1 });
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
                               <div className={cn("flex flex-col w-full h-full space-y-0.5 text-xs leading-tight", cellData.isPast ? "opacity-60" : "", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                  <ul className="space-y-1">
                                    {cellData.bookingEntries.map(entry => (
                                      <li key={entry.reservationId} className={cn("pb-1 mb-0.5 border-b border-slate-200 last:border-b-0", entry.isCurrentUserBooking && "font-semibold")}>
                                        <div className={cn("block font-bold text-base", currentItemForStyling.textClass)}>
                                          {entry.itemName}
                                        </div>
                                        <div>{getLastName(entry.bookedBy)}{itemType === 'device' ? ` (Qty: ${entry.bookedQuantity})` : ''}</div>
                                        {itemType === 'room' && entry.purpose && <div>{entry.purpose}</div>}
                                        {itemType === 'device' && entry.devicePurposes && entry.devicePurposes.length > 0 && <div>{entry.devicePurposes.join(', ')}</div>}
                                        {itemType === 'device' && entry.notes && <div>Notes: {entry.notes}</div>}
                                      </li>
                                    ))}
                                  </ul>
                                   {!cellData.isPast && itemType === 'device' && (
                                      <div className="mt-auto pt-0.5 text-[10px]">
                                          {cellData.availableQuantity !== undefined && cellData.availableQuantity > 0 && <span className="text-green-600 font-medium">({cellData.availableQuantity} remaining)</span>}
                                          {cellData.availableQuantity !== undefined && cellData.availableQuantity <= 0 && <span className="text-red-600 font-medium">(Fully Booked)</span>}
                                      </div>
                                  )}
                              </div>
                            ) : (cellData.status === 'partially-booked' || cellData.status === 'all-booked' || (cellData.status === 'past-booked-all-view' && cellData.isPast) ) && selectedItemId === ALL_ITEMS_ID && cellData.bookingEntries && cellData.bookingEntries.length > 0 ? (
                                <div className={cn("flex flex-col w-full h-full space-y-0.5 text-xs leading-tight", cellData.isPast ? "opacity-60" : "", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                   {cellData.displayText && (cellData.isPast || itemType === 'device') && <span className="block font-semibold text-sm text-center mb-1">{cellData.displayText}</span>}
                                   <ul className="space-y-1">
                                    {cellData.bookingEntries.map(entry => {
                                        const itemForStyling = items.find(it => it.id === entry.itemId);
                                        const nameStyling = itemForStyling ? getItemStyling(itemForStyling, itemType) : currentItemForStyling;

                                        return (
                                        <li key={entry.reservationId} className={cn("pb-1 mb-0.5 border-b border-slate-200 last:border-b-0", entry.isCurrentUserBooking && "font-semibold")}>
                                            <div className={cn("font-bold text-base", nameStyling?.textClass)}>{entry.itemName}</div>
                                            <div>{getLastName(entry.bookedBy)}{itemType === 'device' ? ` (Qty: ${entry.bookedQuantity})` : ''}</div>
                                            {itemType === 'room' && entry.purpose && <div>{entry.purpose}</div>}
                                            {itemType === 'device' && entry.devicePurposes && entry.devicePurposes.length > 0 && <div>{entry.devicePurposes.join(', ')}</div>}
                                            {itemType === 'device' && entry.notes && <div>Notes: {entry.notes}</div>}
                                        </li>
                                        );
                                    })}
                                    </ul>
                                </div>
                            ) : (cellData.status === 'available' && !cellData.isPast) ? (
                                <div className={cn("flex-grow flex flex-col items-center justify-center", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                    <span className={cn("font-medium text-xs",
                                      ( (selectedItemId !== ALL_ITEMS_ID && (cellData.displayText?.startsWith("Available") || cellData.displayText === "No Devices") ) || (selectedItemId === ALL_ITEMS_ID && cellData.displayText?.includes("Available"))) ? "text-primary" : "text-muted-foreground"
                                    )}>
                                      {cellData.displayText}
                                    </span>
                                </div>
                            ) : (cellData.isPast && (cellData.status === 'past-available' || !cellData.displayText)) ? (
                                 <div className="flex-grow flex flex-col items-center justify-center">  </div>
                            ) : (cellData.displayText &&
                                 <div className={cn("flex-grow flex flex-col items-center justify-center", isMultiPeriodMode && isSlotBookableForMultiSelect ? "pl-6" : "")}>
                                     <span className="text-xs text-muted-foreground">{cellData.displayText}</span>
                                </div>
                            )}

                            {showActions && fullReservationObjectForActions && (
                                <div className="absolute top-1 right-1 flex items-center space-x-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150">
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                      onClick={(e) => { e.stopPropagation(); fullReservationObjectForActions && handleSlotAction(day, period, 'edit', fullReservationObjectForActions); }}
                                      aria-label={`Edit booking for ${fullReservationObjectForActions.itemName}`}
                                      disabled={isSlotProcessing || isProcessingGlobal}
                                    > <Edit2 className="h-3.5 w-3.5 text-blue-500" /> </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                                      onClick={(e) => { e.stopPropagation(); fullReservationObjectForActions && onDeleteSlot(fullReservationObjectForActions.id); }}
                                      aria-label={`Delete booking for ${fullReservationObjectForActions.itemName}`}
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
                    onValueChange={(value) => { setModalSelectedItemIdForBooking(value); if(itemType === 'device') setBookingQuantity(1); }}
                    required
                  >
                    <SelectTrigger id="modal-item-select" className="w-full">
                      <SelectValue placeholder={`Choose an available ${itemDisplayName.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter(item => {
                          const specificItemReservations = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                           if (itemType === 'device') {
                            const bookedUnitsForItem = specificItemReservations.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                            const itemTotalQty = (item as Device).quantity;
                            return itemTotalQty - bookedUnitsForItem > 0;
                           }
                           return specificItemReservations.length === 0;
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
                          if (itemType === 'device') {
                             const bookedUnitsForItem = specificItemReservations.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                             const itemTotalQty = (item as Device).quantity;
                             return itemTotalQty - bookedUnitsForItem > 0;
                          }
                          return specificItemReservations.length === 0;
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
                    <div className="max-h-32 overflow-y-auto border rounded-md p-2">
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
                    </div>
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

       {currentSelectedItem && onConfirmMultiBook && (
        <Dialog open={multiBookModalOpen} onOpenChange={setMultiBookModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">Book Multiple Periods for {currentSelectedItem.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <p className="text-sm">You are booking <strong>{selectedMultiSlots.size}</strong> period(s) for <strong>{itemType === 'device' ? `${(currentSelectedItem as Device).roomName || 'N/A'} - ` : ''}{currentSelectedItem.name}</strong>.</p>
              <div className="max-h-24 overflow-y-auto border rounded-md p-2 text-sm">
                <ul>
                  {Array.from(selectedMultiSlots.values()).map(slot => (
                    <li key={`${slot.day.toISOString()}-${slot.period.name}`}>
                      {format(slot.day, 'EEE, MMM dd')} - {slot.period.name} ({slot.period.label})
                    </li>
                  ))}
                </ul>
              </div>

              {itemType === 'device' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="multi-booking-quantity" className="font-medium">Quantity to Book (per period):</Label>
                    <Input
                      id="multi-booking-quantity"
                      type="number"
                      value={multiBookQuantity}
                      onChange={(e) => setMultiBookQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      min="1"
                      max={maxQuantityForMultiBookDevice}
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal || maxQuantityForMultiBookDevice === 0}
                    />
                    {multiBookQuantity > maxQuantityForMultiBookDevice && <p className="text-xs text-red-500">Max available quantity across selected slots is {maxQuantityForMultiBookDevice}.</p>}
                    {maxQuantityForMultiBookDevice === 0 && <p className="text-xs text-red-500">No units consistently available across all selected slots for booking this quantity.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Purpose (select all that apply):</Label>
                    <div className="max-h-32 overflow-y-auto border rounded-md p-2">
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
                    </div>
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
                </>
              )}
              {itemType === 'room' && (
                <div className="space-y-1.5">
                    <Label htmlFor="multi-room-purpose" className="font-medium">Purpose for all selected periods:</Label>
                    <Input
                      id="multi-room-purpose"
                      value={multiBookRoomPurpose}
                      onChange={(e) => setMultiBookRoomPurpose(e.target.value)}
                      placeholder="e.g., English Department Meetings"
                      className="text-sm"
                      disabled={isSlotProcessing || isProcessingGlobal}
                    />
                </div>
              )}
            </div>
            <DialogFooter className="mt-2">
              <DialogClose asChild><Button variant="outline" disabled={isSlotProcessing}>Cancel</Button></DialogClose>
              <Button
                onClick={confirmMultiBook}
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

    