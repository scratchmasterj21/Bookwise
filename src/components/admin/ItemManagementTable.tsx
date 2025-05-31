"use client";

import type { Device, Room } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Trash2, Edit3, Laptop, DoorOpen, Package } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '../ui/badge';

type Item = Device | Room;
type ItemType = 'device' | 'room';

interface ItemManagementTableProps {
  items: Item[];
  itemType: ItemType;
  onEdit: (item: Item) => void;
  onDelete: (itemId: string) => void;
}

const ItemIcon = ({ itemType, specificType }: { itemType: ItemType, specificType?: Device['type'] }) => {
  if (itemType === 'device') {
    switch (specificType) {
      case 'Laptop': return <Laptop className="h-5 w-5 text-primary" />;
      case 'Tablet': return <Laptop className="h-5 w-5 text-primary" />; // Using Laptop as placeholder, update if Tablet icon is available
      default: return <Package className="h-5 w-5 text-primary" />;
    }
  }
  return <DoorOpen className="h-5 w-5 text-primary" />;
};


export default function ItemManagementTable({
  items,
  itemType,
  onEdit,
  onDelete,
}: ItemManagementTableProps) {

  if (items.length === 0) {
    return <p className="text-muted-foreground mt-4 text-center">No {itemType}s found. Add some!</p>;
  }
  
  return (
    <div className="rounded-lg border shadow-sm overflow-hidden animate-subtle-fade-in">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>{itemType === 'device' ? 'Type' : 'Capacity'}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.imageUrl ? (
                  <Image 
                    src={item.imageUrl} 
                    alt={item.name} 
                    width={40} 
                    height={40} 
                    className="rounded object-cover" 
                    data-ai-hint={itemType === 'device' ? "technology device" : "meeting room"}
                  />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                    <ItemIcon itemType={itemType} specificType={'type' in item ? item.type as Device['type'] : undefined} />
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                {itemType === 'device' && 'type' in item ? (item as Device).type : ''}
                {itemType === 'room' && 'capacity' in item ? (item as Room).capacity : ''}
              </TableCell>
              <TableCell>
                <Badge variant={item.status === 'available' ? 'default' : item.status === 'booked' ? 'secondary' : 'destructive'} className="capitalize">
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item)} className="hover:text-primary">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
