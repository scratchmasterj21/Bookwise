
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
  onSave: (itemData: Item) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  buildings?: Building[]; // For room and device forms
  allRooms?: Room[]; // For device form, to filter by building
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

  // Common fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState(''); // For Device/Room
  const [imageUrl, setImageUrl] = useState(''); // For Device/Room/Building
  const [status, setStatus] = useState<'available' | 'booked' | 'maintenance'>('available'); // For Device/Room

  // Building specific
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Device specific
  const [specificType, setSpecificType] = useState<DeviceType | ''>('');
  
  // Room specific
  const [capacity, setCapacity] = useState<number>(0);
  const [amenities, setAmenities] = useState(''); // Comma-separated

  // Location fields for Room/Device
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined); // For Device

  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!itemData?.id;

  const availableRoomsInSelectedBuilding = selectedBuildingId 
    ? allRooms.filter(room => room.buildingId === selectedBuildingId)
    : [];

  useEffect(() => {
    if (open && itemData) {
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
        setSelectedRoomId(d.roomId || undefined);
      }
    } else if (open && !itemData) {
      // Reset form for new item
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
  }, [itemData, itemType, open, allRooms]); // Added allRooms to dependencies for device room filtering

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const baseData = {
      id: itemData?.id || undefined, // Let backend generate ID for new items if needed, or generate on client
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
    
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate save
    onSave(finalData);
    setIsSaving(false);
    onOpenChange(false);
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
                    <SelectValue placeholder={!selectedBuildingId ? "Select building first" : "Select room"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoomsInSelectedBuilding.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!selectedBuildingId && <span className="col-span-3 col-start-2 text-xs text-muted-foreground">Please select a building to see available rooms.</span>}
                {selectedBuildingId && availableRoomsInSelectedBuilding.length === 0 && <span className="col-span-3 col-start-2 text-xs text-muted-foreground">No rooms available in selected building.</span>}
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
                  <SelectItem value="booked">Booked</SelectItem>
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
