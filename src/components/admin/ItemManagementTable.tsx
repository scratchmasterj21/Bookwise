
"use client";

import type { Device, Room, Building } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Trash2, Edit3, Laptop, DoorOpen, Package, Warehouse, Tablet, Monitor as MonitorIcon, Tv, Layers, MapPin, Boxes } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '../ui/badge';

type Item = Device | Room | Building;
type ItemType = 'device' | 'room' | 'building';

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
      case 'Tablet': return <Tablet className="h-5 w-5 text-primary" />;
      case 'Monitor': return <MonitorIcon className="h-5 w-5 text-primary" />;
      case 'Projector': return <Tv className="h-5 w-5 text-primary" />;
      default: return <Package className="h-5 w-5 text-primary" />;
    }
  }
  if (itemType === 'room') {
    return <DoorOpen className="h-5 w-5 text-primary" />;
  }
  if (itemType === 'building') {
    return <Warehouse className="h-5 w-5 text-primary" />;
  }
  return <Package className="h-5 w-5 text-primary" />;
};

const getRoomStatusBadgeVariant = (status: Room['status']): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'available': return 'default';
    case 'booked': return 'secondary';
    case 'maintenance': return 'destructive';
    case 'storage': return 'outline';
    default: return 'default';
  }
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

  const renderTableHeader = () => {
    if (itemType === 'building') {
      return (
        <TableRow><TableHead>Image</TableHead><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead className="flex items-center gap-1"><Layers className="h-4 w-4 text-muted-foreground" /> Floors</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
      );
    }
    if (itemType === 'room') {
      return (
        <TableRow><TableHead>Image</TableHead><TableHead>Name</TableHead><TableHead>Building</TableHead><TableHead className="flex items-center gap-1"><MapPin className="h-4 w-4 text-muted-foreground" /> Floor</TableHead><TableHead>Capacity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
      );
    }
    // Device (default)
    return (
      <TableRow><TableHead>Image</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="flex items-center gap-1"><Boxes className="h-4 w-4 text-muted-foreground" /> Qty</TableHead><TableHead>Location (Building/Room)</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
    );
  };

  const renderTableRow = (item: Item) => {
    const commonImageCell = (
      <TableCell>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={40}
            height={40}
            className="rounded object-cover aspect-square"
            data-ai-hint={itemType === 'device' ? "technology device" : itemType === 'room' ? "meeting room" : "building exterior"}
          />
        ) : (
          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
            <ItemIcon itemType={itemType} specificType={'type' in item ? item.type as Device['type'] : undefined} />
          </div>
        )}
      </TableCell>
    );

    if (itemType === 'building') {
      const b = item as Building;
      return (
        <TableRow key={b.id}>
          {commonImageCell}
          <TableCell className="font-medium">{b.name}</TableCell>
          <TableCell>{b.location || 'N/A'}</TableCell>
          <TableCell>{b.numberOfFloors || 'N/A'}</TableCell>
          <TableCell className="truncate max-w-xs">{b.notes || 'N/A'}</TableCell>
          <TableCell className="text-right space-x-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(b)} className="hover:text-primary">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(b.id)} className="hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      );
    }

    if (itemType === 'room') {
      const r = item as Room;
      return (
        <TableRow key={r.id}>
          {commonImageCell}
          <TableCell className="font-medium">{r.name}</TableCell>
          <TableCell>{r.buildingName || 'N/A'}</TableCell>
          <TableCell>{r.floorNumber || 'N/A'}</TableCell>
          <TableCell>{r.capacity}</TableCell>
          <TableCell>
            <Badge variant={getRoomStatusBadgeVariant(r.status)} className="capitalize">
              {r.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right space-x-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(r)} className="hover:text-primary">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} className="hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      );
    }

    // Device
    const d = item as Device;
    return (
      <TableRow key={d.id}>{commonImageCell}<TableCell className="font-medium">{d.name}</TableCell><TableCell>{d.type}</TableCell><TableCell>{d.quantity}</TableCell><TableCell>{`${d.buildingName || 'N/A'} / ${d.roomName || 'N/A'}`}</TableCell><TableCell>
          <Badge variant={d.status === 'available' ? 'default' : d.status === 'booked' ? 'secondary' : 'destructive'} className="capitalize">
            {d.status}
          </Badge>
        </TableCell><TableCell className="text-right space-x-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(d)} className="hover:text-primary">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)} className="hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell></TableRow>
    );
  };

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden animate-subtle-fade-in">
      <Table>
        <TableHeader>{renderTableHeader()}</TableHeader>
        <TableBody>
          {items.map((item) => renderTableRow(item))}
        </TableBody>
      </Table>
    </div>
  );
}

