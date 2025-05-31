
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ItemManagementTable from '@/components/admin/ItemManagementTable';
import ItemFormDialog from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import type { Building } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { addBuilding, getBuildings, updateBuilding, deleteBuilding as deleteBuildingFromDB } from '@/services/firestoreService';

export default function ManageBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchBuildingsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedBuildings = await getBuildings();
      setBuildings(fetchedBuildings);
    } catch (error) {
      console.error("Error fetching buildings:", error);
      toast({ title: "Error", description: "Could not fetch buildings.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBuildingsData();
  }, [fetchBuildingsData]);

  const handleSaveBuilding = async (buildingData: Partial<Building>) => {
    setIsProcessing(true);
    try {
      if (editingBuilding && editingBuilding.id) {
        // Ensure ID is not part of the update payload for partial updates
        const { id, ...updateData } = buildingData;
        await updateBuilding(editingBuilding.id, updateData);
        toast({ title: "Building Updated", description: `${buildingData.name || editingBuilding.name} has been updated.` });
      } else {
        if (!buildingData.name) {
            toast({ title: "Missing Information", description: "Building name is required.", variant: "destructive"});
            setIsProcessing(false);
            return;
        }
        const newBuildingData = buildingData as Omit<Building, 'id'>; 
        await addBuilding(newBuildingData);
        toast({ title: "Building Added", description: `${buildingData.name} has been added.` });
      }
      setEditingBuilding(null);
      setIsFormOpen(false);
      fetchBuildingsData(); 
    } catch (error) {
      console.error("Error saving building:", error);
      toast({ title: "Error", description: "Could not save building.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBuilding = async (buildingId: string) => {
    setIsProcessing(true);
    try {
      await deleteBuildingFromDB(buildingId);
      toast({ title: "Building Deleted", description: `Building ID ${buildingId} has been deleted.`, variant: "destructive" });
      fetchBuildingsData(); 
    } catch (error) {
      console.error("Error deleting building:", error);
      toast({ title: "Error", description: "Could not delete building.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
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
            <Button onClick={openAddForm} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add New Building
            </Button>
          }
        />
      </div>
      {(isLoading || isProcessing) && buildings.length > 0 && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-4" />}
      {!isLoading && buildings.length === 0 && <p className="text-center text-muted-foreground mt-4">No buildings found. Add one to get started!</p>}
      <ItemManagementTable
        items={buildings}
        itemType="building"
        onEdit={openEditForm}
        onDelete={handleDeleteBuilding}
      />
    </div>
  );
}
