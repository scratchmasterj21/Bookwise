
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Device, Room, Building, DeviceType } from '@/types';
import { Loader2 } from 'lucide-react';

type Item = Partial<Device | Room | Building>;
type ItemType = 'device' | 'room' | 'building';

interface ItemFormDialogProps {
  itemType: ItemType;
  itemData?: Item | null;
  triggerButton?: React.ReactNode;
  onSave: (itemData: Item) => Promise<void>; // Changed to Promise<void>
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  buildings?: Building[];
  allRooms?: Room[];
}

const deviceTypes: DeviceType[] = ['Laptop', 'Tablet', 'Monitor', 'Projector', 'Other'];

export default function ItemFormDialog({
  itemType,
  itemData,
  triggerButton,
  onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  buildings = [],
  allRooms = [],
}: ItemFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'available' | 'booked' | 'maintenance'>('available');

  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [specificType, setSpecificType] = useState<DeviceType | ''>('');
  
  const [capacity, setCapacity] = useState<number>(0);
  const [amenities, setAmenities] = useState('');

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!itemData?.id;

  const availableRoomsInSelectedBuilding = selectedBuildingId 
    ? allRooms.filter(room => room.buildingId === selectedBuildingId)
    : [];

  useEffect(() => {
    if (open) {
      if (itemData) { // Editing existing item
        setName(itemData.name || '');
        setImageUrl(itemData.imageUrl || '');

        if (itemType === 'building') {
          const b = itemData as Building;
          setLocation(b.location || '');
          setNotes(b.notes || '');
        } else if (itemType === 'room') {
          const r = itemData as Room;
          setDescription(r.description || '');
          setStatus(r.status || 'available');
          setCapacity(r.capacity || 0);
          setAmenities(r.amenities?.join(', ') || '');
          setSelectedBuildingId(r.buildingId || undefined);
        } else if (itemType === 'device') {
          const d = itemData as Device;
          setDescription(d.description || '');
          setStatus(d.status || 'available');
          setSpecificType(d.type || '');
          setSelectedBuildingId(d.buildingId || undefined);
          // Ensure selectedRoomId is reset if the building changes or rooms for that building are not available
          const currentBuildingRooms = itemData.buildingId ? allRooms.filter(room => room.buildingId === itemData.buildingId) : [];
          if (d.roomId && currentBuildingRooms.find(r => r.id === d.roomId)) {
            setSelectedRoomId(d.roomId);
          } else {
            setSelectedRoomId(undefined);
          }
        }
      } else { // Reset form for new item
        setName('');
        setDescription('');
        setImageUrl(itemType !== 'building' ? 'https://placehold.co/600x400.png' : '');
        setStatus('available');
        setSpecificType('');
        setCapacity(0);
        setAmenities('');
        setLocation('');
        setNotes('');
        setSelectedBuildingId(undefined);
        setSelectedRoomId(undefined);
      }
    }
  }, [open, itemData, itemType, allRooms]); // allRooms IS needed here for device room population/reset if allRooms changes.
                                         // The issue was specific to 'building' type where allRooms defaults to new [].
                                         // For building type, allRooms isn't used in the effect logic for its fields.
                                         // The root cause was default prop `allRooms = []` creating new ref.
                                         // This is less of an issue if parent `ManageBuildingPage` passes a stable `allRooms` or `undefined`.
                                         // To be absolutely safe for the typing issue with buildings, the reset specific to `name`, `location`, `notes` should ideally not run if only `allRooms` changed.
                                         // However, with `ManageBuildingsPage` not passing `allRooms`, `allRooms` in this component is `[]` (new ref each render).
                                         // Let's refine: the general reset should primarily depend on open/itemData/itemType.

  useEffect(() => {
    // This effect handles the general form reset and population based on itemData and itemType.
    // It should not be sensitive to `allRooms` changing for non-device types or for field initializations
    // that don't depend on `allRooms`.
    if (open) {
        if (itemData) { // Editing existing item
            setName(itemData.name || '');
            setImageUrl(itemData.imageUrl || '');

            if (itemType === 'building') {
                const b = itemData as Building;
                setLocation(b.location || '');
                setNotes(b.notes || '');
            } else if (itemType === 'room') {
                const r = itemData as Room;
                setDescription(r.description || '');
                setStatus(r.status || 'available');
                setCapacity(r.capacity || 0);
                setAmenities(r.amenities?.join(', ') || '');
                setSelectedBuildingId(r.buildingId || undefined);
            } else if (itemType === 'device') {
                const d = itemData as Device;
                setDescription(d.description || '');
                setStatus(d.status || 'available');
                setSpecificType(d.type || '');
                setSelectedBuildingId(d.buildingId || undefined);
                // Room selection logic for devices is handled below, potentially based on allRooms
            }
        } else { // Reset form for new item
            setName('');
            setDescription('');
            setImageUrl(itemType !== 'building' ? 'https://placehold.co/600x400.png' : '');
            setStatus('available');
            setSpecificType('');
            setCapacity(0);
            setAmenities('');
            setLocation('');
            setNotes('');
            setSelectedBuildingId(undefined);
            setSelectedRoomId(undefined);
        }
    }
  }, [open, itemData, itemType]); // Removed allRooms from this general effect

  useEffect(() => {
    // This effect specifically handles initializing/updating selectedRoomId for devices,
    // especially if allRooms data changes or buildingId changes.
    if (open && itemType === 'device') {
        if (itemData) { // Editing a device
            const d = itemData as Device;
            const currentBuildingRooms = d.buildingId ? allRooms.filter(room => room.buildingId === d.buildingId) : [];
            if (d.roomId && currentBuildingRooms.find(r => r.id === d.roomId)) {
                setSelectedRoomId(d.roomId);
            } else {
                setSelectedRoomId(undefined); // Reset if room not valid for current building or not found
            }
        } else { // Adding a new device
             // selectedRoomId is already reset to undefined by the general effect.
             // If selectedBuildingId changes for a new device, availableRoomsInSelectedBuilding updates,
             // and the Select component for rooms will correctly show/hide options.
        }
    }
  }, [open, itemData, itemType, selectedBuildingId, allRooms]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const baseData = {
      id: itemData?.id || undefined,
      name,
      imageUrl,
    };

    let finalData: Item;

    if (itemType === 'building') {
      finalData = { ...baseData, location, notes } as Building;
    } else if (itemType === 'room') {
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
      finalData = { 
        ...baseData, 
        description, 
        status, 
        capacity, 
        amenities: amenities.split(',').map(a => a.trim()).filter(a => a),
        buildingId: selectedBuildingId,
        buildingName: selectedBuilding?.name,
      } as Room;
    } else { // device
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
      const selectedRoom = allRooms.find(r => r.id === selectedRoomId);
      finalData = { 
        ...baseData, 
        description, 
        status, 
        type: specificType as DeviceType,
        buildingId: selectedBuildingId,
        buildingName: selectedBuilding?.name,
        roomId: selectedRoomId,
        roomName: selectedRoom?.name,
      } as Device;
    }
    
    try {
      await onSave(finalData);
      // Only close dialog if save was successful (onSave didn't throw)
      // The parent's onSave (handleSaveBuilding/Room/Device) is responsible for toasts.
      onOpenChange(false); 
    } catch (error) {
      // Error is already logged and toasted by the onSave handler in the parent component.
      // We don't re-throw or toast again here. The dialog remains open.
      console.error(`Error during ${itemType} save operation in dialog:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? `Edit ${itemType}` : `Add New ${itemType}`}</DialogTitle>
          <DialogDescription>
            Fill in the details for the {itemType}. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
          </div>

          {itemType !== 'building' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="imageUrl" className="text-right">Image URL</Label>
            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="col-span-3" placeholder={itemType !== 'building' ? "https://placehold.co/600x400.png" : "Optional image URL"}/>
          </div>
          
          {itemType === 'building' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" />
              </div>
            </>
          )}

          {itemType === 'room' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="capacity" className="text-right">Capacity</Label>
                <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amenities" className="text-right">Amenities</Label>
                <Input id="amenities" value={amenities} onChange={(e) => setAmenities(e.target.value)} className="col-span-3" placeholder="e.g. Projector, Whiteboard" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="building-select-room" className="text-right">Building</Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          
          {itemType === 'device' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="device-type" className="text-right">Type</Label>
                <Select value={specificType} onValueChange={(value) => setSpecificType(value as DeviceType)} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="building-select-device" className="text-right">Building</Label>
                <Select value={selectedBuildingId} onValueChange={(value) => {setSelectedBuildingId(value); setSelectedRoomId(undefined);}} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="room-select-device" className="text-right">Room</Label>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={!selectedBuildingId || availableRoomsInSelectedBuilding.length === 0} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={!selectedBuildingId ? "Select building first" : (availableRoomsInSelectedBuilding.length === 0 ? "No rooms in building" : "Select room")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoomsInSelectedBuilding.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!selectedBuildingId && <span className="col-span-3 col-start-2 text-xs text-muted-foreground">Please select a building to see available rooms.</span>}
                {selectedBuildingId && availableRoomsInSelectedBuilding.length === 0 && <span className="col-span-3 col-start-2 text-xs text-muted-foreground">No rooms available in selected building. Add rooms to this building first.</span>}
              </div>
            </>
          )}

          {itemType !== 'building' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'available' | 'booked' | 'maintenance')}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem> {/* Note: status is usually managed by reservations, not directly set here for new items */}
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : `Add ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


    