
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Room, Reservation, TimePeriod, Device, DeviceType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Edit2, Loader2, Trash2, Package, Laptop, Tablet, Monitor as MonitorIcon, Tv as ProjectorIcon } from 'lucide-react';
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

const ALL_ITEMS_ID = "---all---";

type Item = Room | Device;

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
  initialDate?: Date;
  isProcessingGlobal?: boolean;
  itemDisplayName?: string;
  bookingModalPurposeLabel?: string;
}

interface CellDisplayInfo {
  status: 'available' | 'booked' | 'partially-booked' | 'all-booked' | 'past-available' | 'past-booked' | 'past-booked-all-view' | 'insufficient-quantity';
  isPast: boolean;
  displayText?: string;
  bookedBy?: string;
  purpose?: string;
  devicePurposes?: string[];
  notes?: string;
  bookedQuantity?: number; // Added
  itemName?: string;
  isCurrentUserBooking?: boolean;
  mainReservation?: Reservation;
  bookedUnits?: number; // Renamed from bookedCount for clarity with devices
  itemTotalQuantity?: number; // Renamed from itemQuantity for clarity
  totalAvailableUnits?: number; // For ALL_ITEMS_ID view
  totalPotentialUnits?: number; // For ALL_ITEMS_ID view
}

interface ItemStyling {
  borderClass: string;
  textClass: string;
  icon?: React.ElementType;
  backgroundClass?: string;
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

  const [bookingPurpose, setBookingPurpose] = useState('');
  const [selectedDevicePurposes, setSelectedDevicePurposes] = useState<string[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingQuantity, setBookingQuantity] = useState<number>(1); // For device quantity

  const [modalSelectedItemIdForBooking, setModalSelectedItemIdForBooking] = useState<string | undefined>(undefined);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);


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

  const handleDevicePurposeChange = (purpose: string) => {
    setSelectedDevicePurposes(prev =>
      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
    );
  };

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
      if (res.itemType !== itemType) return false;
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
                if (totalBookedUnits > 0) return { status: 'past-booked-all-view', isPast: true, displayText: `${totalBookedUnits} Unit(s) Booked`, totalAvailableUnits, totalPotentialUnits };
                return { status: 'past-available', isPast: true, displayText: "", totalAvailableUnits, totalPotentialUnits };
            }
            if (totalAvailableUnits <= 0 && totalPotentialUnits > 0) {
                return { status: 'all-booked', isPast: false, displayText: "All Device Units Booked", totalAvailableUnits, totalPotentialUnits };
            }
            if (totalBookedUnits > 0) {
                 return { status: 'partially-booked', isPast: false, displayText: `${totalAvailableUnits} of ${totalPotentialUnits} Units Available`, totalAvailableUnits, totalPotentialUnits };
            }
            return { status: 'available', isPast: false, displayText: totalPotentialUnits > 0 ? `${totalPotentialUnits} Units Available` : "No Devices", totalAvailableUnits, totalPotentialUnits };
        }
    }

    const currentItem = items.find(i => i.id === selectedItemId);
    if (!currentItem) return { status: 'past-available', isPast: true, displayText: ""}; // Should not happen if an item is selected

    const reservationsInSlot = getReservationsForSlot(day, period, selectedItemId);

    if (itemType === 'device') {
        const device = currentItem as Device;
        const totalBookedUnits = reservationsInSlot.reduce((sum, res) => sum + (res.bookedQuantity || 1), 0);
        const availableQuantity = device.quantity - totalBookedUnits;
        const firstReservation = reservationsInSlot[0]; // For displaying details of one booking

        if (isPast) {
             if (totalBookedUnits > 0) return {
                status: 'past-booked', isPast: true, bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, itemName: device.name, isCurrentUserBooking: firstReservation?.userId === user?.uid, mainReservation: firstReservation, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity
            };
            return { status: 'past-available', isPast: true, itemName: device.name, displayText: "" };
        }
        if (availableQuantity <= 0) { // All units of this specific device are booked
            return { status: 'all-booked', isPast: false, itemName: device.name, displayText: "Fully Booked", bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, isCurrentUserBooking: firstReservation?.userId === user?.uid, mainReservation: firstReservation, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity };
        }

        if (totalBookedUnits > 0) { // Some units booked, some available
             return { status: 'booked', isPast: false, bookedBy: firstReservation?.bookedBy, devicePurposes: firstReservation?.devicePurposes, notes: firstReservation?.notes, bookedQuantity: firstReservation?.bookedQuantity, itemName: device.name, isCurrentUserBooking: firstReservation?.userId === user?.uid, mainReservation: firstReservation, displayText: `${availableQuantity} left`, bookedUnits: totalBookedUnits, itemTotalQuantity: device.quantity };
        }
        // All units available
        return { status: 'available', isPast: false, itemName: device.name, displayText: `Available (${device.quantity})`, itemTotalQuantity: device.quantity };
    }


    // Room logic (single booking per slot)
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

    if (isToday(day) && cellData.status !== 'past-available' && cellData.status !== 'past-booked' && cellData.status !== 'past-booked-all-view') {
        baseClasses = cn(baseClasses, "bg-primary/5");
    }

    const currentItem = items.find(i => i.id === selectedItemId);
    const itemStyling = currentItem ? getItemStyling(currentItem, itemType) : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());

    if (cellData.isPast) {
        if (cellData.status === 'past-booked' || cellData.status === 'past-booked-all-view') {
            baseClasses = cn(baseClasses, `bg-slate-100 ${itemStyling.borderClass} border-dashed opacity-60 cursor-default`);
        } else {
            baseClasses = cn(baseClasses, "bg-slate-50 border-slate-200 border-dashed cursor-default");
        }
    } else {
        if (cellData.status === 'booked' && selectedItemId !== ALL_ITEMS_ID) {
            const backgroundClass = cellData.isCurrentUserBooking ? 'bg-green-50' : (itemType === 'room' ? getItemStyling(currentItem!, itemType).backgroundClass : getItemStyling(currentItem!, itemType).backgroundClass);
            baseClasses = cn(baseClasses, `${backgroundClass} ${itemStyling.borderClass} border-2`, "cursor-pointer");
        } else if (cellData.status === 'available') {
            baseClasses = cn(baseClasses, "bg-background hover:bg-primary/10 border-slate-200 cursor-pointer transition-colors duration-150");
        } else if (cellData.status === 'all-booked' && selectedItemId !== ALL_ITEMS_ID) {
             baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-300 cursor-not-allowed", itemStyling.borderClass);
        } else if (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID) {
             baseClasses = cn(baseClasses, "bg-red-50 text-red-700 border-red-200 cursor-pointer");
        } else if (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) {
            baseClasses = cn(baseClasses, "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700 cursor-pointer transition-colors duration-150");
        } else { // Default for ALL_ITEMS view when available, or unexpected states
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
            description: cellData.status === 'past-booked-all-view' ? cellData.displayText : `${getLastName(cellData.bookedBy)} - ${cellData.purpose || cellData.devicePurposes?.join(', ') || 'N/A'}${itemType === 'device' ? ` (Qty: ${cellData.bookedQuantity || 1})` : ''}${cellData.notes ? `. Notes: ${cellData.notes}` : ''}`
        });
      } else {
        toast({ title: "Past Slot", description: "This slot cannot be booked."});
      }
      return;
    }

    const canManageCurrentBooking = isAdmin || cellData.isCurrentUserBooking;

    if ((cellData.status === 'booked' || (cellData.status === 'all-booked' && itemType === 'device' && cellData.mainReservation)) && selectedItemId !== ALL_ITEMS_ID) {
        if (canManageCurrentBooking && cellData.mainReservation) {
            handleSlotAction(day, period, 'edit', cellData.mainReservation);
        } else {
             toast({
                title: "Booking Details",
                description: `${cellData.itemName}: ${getLastName(cellData.bookedBy)} - ${cellData.purpose || cellData.devicePurposes?.join(', ') || 'N/A'}${itemType === 'device' ? ` (Qty: ${cellData.bookedQuantity || 1})` : ''}${cellData.notes ? `. Notes: ${cellData.notes}` : ''}`
            });
        }
    } else if (cellData.status === 'available' || (cellData.status === 'partially-booked' && selectedItemId === ALL_ITEMS_ID) || (cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID && itemType === 'device' && cellData.totalAvailableUnits && cellData.totalAvailableUnits > 0) || (cellData.status === 'available' && selectedItemId === ALL_ITEMS_ID && itemType === 'device' && cellData.totalPotentialUnits && cellData.totalPotentialUnits > 0 )) {
        handleSlotAction(day, period, 'book');
    } else if ((cellData.status === 'all-booked' && selectedItemId === ALL_ITEMS_ID && itemType === 'room') || (cellData.status === 'all-booked' && itemType === 'device' && selectedItemId !== ALL_ITEMS_ID && !canManageCurrentBooking)) {
        toast({ title: `No ${itemDisplayName}s Available`, description: `All units of this ${itemDisplayName.toLowerCase()} are booked for this slot.`, variant: "default" });
    }
  };

  const getMaxBookableQuantity = () => {
    if (!currentBookingSlot) return 1;
    const { day, period, item: modalItem, existingReservation } = currentBookingSlot;
    const itemForCalc = modalItem || (modalSelectedItemIdForBooking ? items.find(i => i.id === modalSelectedItemIdForBooking) : null);

    if (itemType === 'device' && itemForCalc) {
      const device = itemForCalc as Device;
      const reservationsInSlot = getReservationsForSlot(day, period, device.id);
      let totalBookedByOthers = 0;
      reservationsInSlot.forEach(res => {
        if (res.id !== existingReservation?.id) { // Exclude current booking if editing
          totalBookedByOthers += (res.bookedQuantity || 1);
        }
      });
      const maxQty = device.quantity - totalBookedByOthers;
      return Math.max(1, maxQty); // Ensure it's at least 1 if bookable at all
    }
    return 1; // Default for rooms or if device not found
  };


  const isBookingButtonDisabled = () => {
    if (isSlotProcessing || isProcessingGlobal) return true;
    if (selectedItemId === ALL_ITEMS_ID && !editingReservationId && !modalSelectedItemIdForBooking) return true;

    if (itemType === 'room' && !bookingPurpose.trim()) return true;
    if (itemType === 'device') {
      if (selectedDevicePurposes.length === 0) return true;
      if (bookingQuantity < 1 || bookingQuantity > getMaxBookableQuantity()) return true;
    }
    return false;
  };


  return (
    <Card className="shadow-xl w-full animate-subtle-fade-in border-border">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 pb-4 pt-4 px-4 border-b bg-primary/5">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={isProcessingGlobal || isSlotProcessing}>
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
                       <div className="text-sm font-semibold text-foreground">{period.name}</div>
                       <div className="text-xs text-muted-foreground mt-0.5">{period.label}</div>
                    </td>
                    {weekDays.map(day => {
                      const slotKey = `${day.toISOString()}-${period.name}`;
                      const cellData = getCellDisplayData(day, period);
                      const currentItem = items.find(i => i.id === selectedItemId);
                      const itemStyling = currentItem ? getItemStyling(currentItem, itemType) : (itemType === 'room' ? getRoomStyling() : getDeviceStyling());

                      const showActions = (isAdmin || cellData.isCurrentUserBooking) && cellData.mainReservation && !cellData.isPast && selectedItemId !== ALL_ITEMS_ID && hoveredSlot === slotKey;

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
                                <div className="flex-grow">
                                    <span className={cn("block font-semibold text-[11px] leading-tight", itemStyling.textClass)}>
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
                            ) : (cellData.status === 'available' && !cellData.isPast) ? (
                                <div className="flex-grow flex flex-col items-center justify-center">
                                    <span className={cn("font-medium text-xs", selectedItemId !== ALL_ITEMS_ID && cellData.displayText !== 'No Devices' ? "text-primary" : "text-muted-foreground")}>{cellData.displayText}</span>
                                </div>
                            ) : (cellData.status === 'partially-booked' || cellData.status === 'all-booked' ) && !cellData.isPast ? (
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
                            ) : (cellData.isPast && (cellData.status === 'past-available' || !cellData.displayText)) ? (
                                 <div className="flex-grow flex flex-col items-center justify-center">  </div>
                            ) : (cellData.displayText &&
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
                    onValueChange={(value) => { setModalSelectedItemIdForBooking(value); setBookingQuantity(1); }}
                  >
                    <SelectTrigger id="modal-item-select" className="w-full">
                      <SelectValue placeholder={`Choose an available ${itemDisplayName.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter(item => {
                          const reservationsInSlot = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          if (itemType === 'device') {
                            const totalBooked = reservationsInSlot.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                            return (item as Device).quantity - totalBooked > 0;
                          }
                          return reservationsInSlot.length === 0; // Rooms can only be booked once
                        })
                        .map(item => {
                           let availableUnits = 0;
                           if(itemType === 'device') {
                                const reservationsInSlot = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                                const totalBooked = reservationsInSlot.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                                availableUnits = (item as Device).quantity - totalBooked;
                           }
                           return (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex items-center gap-2">
                                  {itemType === 'device' && getIconForItemType(itemType, (item as Device).type) &&
                                  React.createElement(getIconForItemType(itemType, (item as Device).type)!, {className: "h-4 w-4 text-muted-foreground"})}
                                  {itemType === 'device' ? `${(item as Device).roomName || 'N/A'} - ${item.name} (Available: ${availableUnits})`
                                    : `${item.name}`
                                  }
                              </div>
                            </SelectItem>
                           );
                        })}
                       {items.filter(item => {
                          const reservationsInSlot = getReservationsForSlot(currentBookingSlot.day, currentBookingSlot.period, item.id);
                          if (itemType === 'device') {
                            const totalBooked = reservationsInSlot.reduce((sum, r) => sum + (r.bookedQuantity || 1), 0);
                            return (item as Device).quantity - totalBooked > 0;
                          }
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
                      disabled={isSlotProcessing || isProcessingGlobal || getMaxBookableQuantity() <= 0}
                    />
                    {bookingQuantity > getMaxBookableQuantity() && <p className="text-xs text-red-500">Quantity exceeds available units ({getMaxBookableQuantity()}).</p>}
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
    </Card>
  );
}
