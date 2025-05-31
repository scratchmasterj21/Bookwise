
"use client";

import React, { useState, useEffect } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const initialMockBuildings: Building[] = [
  { id: 'bldg1', name: 'Main Headquarters', location: '123 Tech Avenue', notes: 'Primary admin and operations building.', imageUrl: 'https://placehold.co/600x400.png' },
  { id: 'bldg2', name: 'Research & Development Wing', location: '456 Innovation Drive', notes: 'Contains labs and R&D offices.', imageUrl: 'https://placehold.co/600x400.png' },
];

export default function ManageBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setBuildings(initialMockBuildings);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleSaveBuilding = (buildingData: Partial<Building>) => {
    setIsLoading(true);
    setTimeout(() => {
      if (editingBuilding) {
        setBuildings(buildings.map(b => b.id === editingBuilding.id ? { ...b, ...buildingData } as Building : b));
        toast({ title: "Building Updated", description: `${buildingData.name} has been updated.` });
      } else {
        const newBuilding = { ...buildingData, id: `bldg-${Date.now()}` } as Building;
        setBuildings([...buildings, newBuilding]);
        toast({ title: "Building Added", description: `${newBuilding.name} has been added.` });
      }
      setEditingBuilding(null);
      setIsFormOpen(false);
      setIsLoading(false);
    }, 500);
  };

  const handleDeleteBuilding = (buildingId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setBuildings(buildings.filter(b => b.id !== buildingId));
      // TODO: Add logic to handle rooms/devices within this building (e.g., reassign or warn user)
      toast({ title: "Building Deleted", description: `Building ID ${buildingId} has been deleted.`, variant: 'destructive' });
      setIsLoading(false);
    }, 500);
  };

  const openAddForm = () => {
    setEditingBuilding(null);
    setIsFormOpen(true);
  };

  const openEditForm = (building: Building) => {
    setEditingBuilding(building);
    setIsFormOpen(true);
  };

  if (isLoading && buildings.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold font-headline">Manage Buildings</h2>
        <ItemFormDialog
          itemType="building"
          itemData={editingBuilding}
          onSave={handleSaveBuilding}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          triggerButton={
            <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Building
            </Button>
          }
        />
      </div>
      {isLoading && buildings.length > 0 && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
      <ItemManagementTable
        items={buildings}
        itemType="building"
        onEdit={openEditForm}
        onDelete={handleDeleteBuilding}
      />
    </div>
  );
}
