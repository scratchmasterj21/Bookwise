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
import type { Device, Room, DeviceType } from '@/types';
import { PlusCircle, Edit, Loader2 } from 'lucide-react';

type Item = Partial<Device | Room>;
type ItemType = 'device' | 'room';

interface ItemFormDialogProps {
  itemType: ItemType;
  itemData?: Item | null; // For editing
  triggerButton?: React.ReactNode;
  onSave: (itemData: Item) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const deviceTypes: DeviceType[] = ['Laptop', 'Tablet', 'Monitor', 'Projector', 'Other'];

export default function ItemFormDialog({
  itemType,
  itemData,
  triggerButton,
  onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ItemFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [specificType, setSpecificType] = useState<DeviceType | ''>(''); // For device
  const [capacity, setCapacity] = useState<number>(0); // For room
  const [status, setStatus] = useState<'available' | 'booked' | 'maintenance'>('available');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!itemData?.id;

  useEffect(() => {
    if (itemData) {
      setName(itemData.name || '');
      setDescription((itemData as Device).description || (itemData as Room).description || '');
      setImageUrl(itemData.imageUrl || '');
      setStatus(itemData.status || 'available');
      if (itemType === 'device' && 'type' in itemData) {
        setSpecificType((itemData as Device).type || '');
      }
      if (itemType === 'room' && 'capacity' in itemData) {
        setCapacity((itemData as Room).capacity || 0);
      }
    } else {
      // Reset form for new item
      setName('');
      setDescription('');
      setImageUrl('');
      setSpecificType('');
      setCapacity(0);
      setStatus('available');
    }
  }, [itemData, itemType, open]); // re-populate form when dialog opens with new itemData

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const baseData = {
      id: itemData?.id || Date.now().toString(), // Simple ID generation for mock
      name,
      description,
      imageUrl,
      status,
    };

    let finalData: Item;
    if (itemType === 'device') {
      finalData = { ...baseData, type: specificType as DeviceType } as Device;
    } else {
      finalData = { ...baseData, capacity } as Room;
    }
    
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
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
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="imageUrl" className="text-right">Image URL</Label>
            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="col-span-3" placeholder="https://placehold.co/600x400.png"/>
          </div>
          
          {itemType === 'device' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="device-type" className="text-right">Type</Label>
              <Select value={specificType} onValueChange={(value) => setSpecificType(value as DeviceType)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {itemType === 'room' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="capacity" className="text-right">Capacity</Label>
              <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)} className="col-span-3" />
            </div>
          )}

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
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
