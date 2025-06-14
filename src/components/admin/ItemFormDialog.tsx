
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
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Device, Room, Building, DeviceType } from '@/types';
import { Loader2 } from 'lucide-react';

type Item = Partial<Device | Room | Building>;
type ItemCreationData = Omit<Device, 'id'> | Omit<Room, 'id'> | Omit<Building, 'id'>;
type ItemType = 'device' | 'room' | 'building';

interface ItemFormDialogProps {
  itemType: ItemType;
  itemData?: Item | null;
  triggerButton?: React.ReactNode;
  onSave: (itemData: Item | ItemCreationData) => Promise<void>;
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
  const [status, setStatus] = useState<string>('available'); // Changed to string for flexibility

  // Building specific
  const [location, setLocation] = useState('');
  const [numberOfBuildingFloors, setNumberOfBuildingFloors] = useState<string>("1");
  const [notes, setNotes] = useState('');

  // Device specific
  const [specificType, setSpecificType] = useState<DeviceType | ''>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Room specific
  const [capacity, setCapacity] = useState<number>(0);
  const [amenities, setAmenities] = useState('');
  const [roomFloorNumber, setRoomFloorNumber] = useState<1 | 2 | undefined>(undefined);

  // Common for Room & Device (location in building/room)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!itemData?.id;

  const availableRoomsInSelectedBuilding = selectedBuildingId
    ? allRooms.filter(room => room.buildingId === selectedBuildingId)
    : [];

  const selectedBuildingForRoom = buildings.find(b => b.id === selectedBuildingId);

  useEffect(() => {
    if (open) {
      setIsSaving(false);
      if (itemData) {
        setName(itemData.name || '');
        if ('description' in itemData && typeof itemData.description === 'string') setDescription(itemData.description); else setDescription('');
        if ('status' in itemData && itemData.status) setStatus(itemData.status as string); else setStatus('available');
        if ('imageUrl' in itemData && typeof itemData.imageUrl === 'string') setImageUrl(itemData.imageUrl); else setImageUrl(itemType !== 'building' ? 'https://placehold.co/600x400.png' : '');

        if (itemType === 'building') {
            const b = itemData as Building;
            setLocation(b.location || '');
            setNumberOfBuildingFloors(b.numberOfFloors?.toString() || "1");
            setNotes(b.notes || '');
            if (!b.imageUrl) setImageUrl('');
        } else if (itemType === 'room') {
            const r = itemData as Room;
            setCapacity(r.capacity || 0);
            setAmenities(r.amenities?.join(', ') || '');
            setSelectedBuildingId(r.buildingId || undefined);
            setRoomFloorNumber(r.floorNumber);
            const building = buildings.find(b => b.id === r.buildingId);
            if (building?.numberOfFloors === 1) {
              setRoomFloorNumber(1);
            }
        } else if (itemType === 'device') {
            const d = itemData as Device;
            setSpecificType(d.type || '');
            setSelectedBuildingId(d.buildingId || undefined);
            setQuantity(d.quantity || 1);
        }
      } else { // Reset for new item
        setName('');
        setDescription('');
        setImageUrl(itemType !== 'building' ? 'https://placehold.co/600x400.png' : '');
        setStatus('available');
        setLocation('');
        setNumberOfBuildingFloors("1");
        setNotes('');
        setCapacity(0);
        setAmenities('');
        setRoomFloorNumber(undefined);
        setSpecificType('');
        setQuantity(1);
        setSelectedBuildingId(undefined);
        setSelectedRoomId(undefined);
      }
    }
  }, [open, itemData, itemType, buildings]);

  useEffect(() => {
    if (open && itemType === 'device' && itemData && 'roomId' in itemData) {
        const d = itemData as Device;
        if (d.buildingId === selectedBuildingId || !selectedBuildingId) {
          const currentBuildingRooms = d.buildingId ? allRooms.filter(room => room.buildingId === d.buildingId) : [];
          if (d.roomId && currentBuildingRooms.find(r => r.id === d.roomId)) {
              setSelectedRoomId(d.roomId);
          } else {
              setSelectedRoomId(undefined);
          }
        } else {
          setSelectedRoomId(undefined);
        }
    } else if (open && itemType === 'device' && !itemData) {
        setSelectedRoomId(undefined);
    }
  }, [open, itemData, itemType, selectedBuildingId, allRooms]);

  useEffect(() => {
    if (itemType === 'room') {
      const building = buildings.find(b => b.id === selectedBuildingId);
      if (building) {
        if (building.numberOfFloors === 1) {
          setRoomFloorNumber(1);
        } else {
          if (!itemData || (itemData as Room).buildingId !== selectedBuildingId) {
            setRoomFloorNumber(undefined);
          }
        }
      } else {
        setRoomFloorNumber(undefined); 
      }
    }
  }, [selectedBuildingId, itemType, buildings, itemData, open]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    let dataFields: Partial<Omit<Building, 'id'>> | Partial<Omit<Room, 'id'>> | Partial<Omit<Device, 'id'>>;

    if (itemType === 'building') {
      const payload: Partial<Omit<Building, 'id'>> = {
        name,
        numberOfFloors: parseInt(numberOfBuildingFloors, 10) as 1 | 2,
      };
      if (location && location.trim()) payload.location = location.trim();
      if (notes && notes.trim()) payload.notes = notes.trim();
      if (imageUrl && imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      dataFields = payload;
    } else if (itemType === 'room') {
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
      const payload: Partial<Omit<Room, 'id'>> = {
        name,
        capacity: capacity || 0,
        amenities: amenities.split(',').map(a => a.trim()).filter(a => a),
        buildingId: selectedBuildingId!,
        buildingName: selectedBuilding?.name,
        floorNumber: roomFloorNumber!,
        status: status as Room['status'],
      };
      if (description && description.trim()) payload.description = description.trim();
      if (imageUrl && imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      dataFields = payload;
    } else { // device
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
      const selectedRoom = allRooms.find(r => r.id === selectedRoomId);
      const payload: Partial<Omit<Device, 'id'>> = {
        name,
        type: specificType as DeviceType,
        buildingId: selectedBuildingId!,
        buildingName: selectedBuilding?.name,
        roomId: selectedRoomId!,
        roomName: selectedRoom?.name,
        status: status as Device['status'],
        quantity: quantity || 1,
      };
      if (description && description.trim()) payload.description = description.trim();
      if (imageUrl && imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      dataFields = payload;
    }

    let finalPayload: Item | ItemCreationData;

    if (isEditing && itemData?.id) {
      finalPayload = { ...dataFields, id: itemData.id } as Item;
    } else {
      finalPayload = dataFields as ItemCreationData;
    }

    try {
      await onSave(finalPayload);
      onOpenChange(false);
    } catch (error) {
      console.error(`Error during ${itemType} save operation in dialog:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isSaving) onOpenChange(isOpen); }}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">{isEditing ? `Edit ${itemType}` : `Add New ${itemType}`}</DialogTitle>
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
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="col-span-3"
              placeholder={itemType !== 'building' ? "https://placehold.co/..." : "Optional image URL"}
            />
          </div>

          {itemType === 'building' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="numberOfBuildingFloors" className="text-right">Number of Floors</Label>
                <RadioGroup
                    value={numberOfBuildingFloors}
                    onValueChange={setNumberOfBuildingFloors}
                    className="col-span-3 flex space-x-4"
                    required
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="b-floor1" />
                    <Label htmlFor="b-floor1">1 Floor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="b-floor2" />
                    <Label htmlFor="b-floor2">2 Floors</Label>
                  </div>
                </RadioGroup>
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
                <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)} className="col-span-3" min="0" />
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
              {selectedBuildingForRoom && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="room-floor-number" className="text-right">Floor</Label>
                  {selectedBuildingForRoom.numberOfFloors === 1 ? (
                    <Input value="1" className="col-span-3" readOnly disabled />
                  ) : (
                    <Select
                      value={roomFloorNumber?.toString()}
                      onValueChange={(value) => setRoomFloorNumber(value ? parseInt(value) as 1 | 2 : undefined)}
                      required
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select floor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Floor 1</SelectItem>
                        {selectedBuildingForRoom.numberOfFloors === 2 && <SelectItem value="2">Floor 2</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
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
                <Label htmlFor="quantity" className="text-right">Quantity</Label>
                <Input 
                  id="quantity" 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                  className="col-span-3" 
                  min="1"
                  required 
                />
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
                    {availableRoomsInSelectedBuilding.map(r => <SelectItem key={r.id} value={r.id}>{r.name} (Floor {r.floorNumber})</SelectItem>)}
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
              <Select value={status} onValueChange={(value) => setStatus(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {itemType === 'room' && (
                    <>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                    </>
                  )}
                  {itemType === 'device' && (
                    <>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </>
                  )}
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
