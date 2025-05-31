
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
}

export type DeviceType = 'Laptop' | 'Tablet' | 'Monitor' | 'Projector' | 'Other';

export interface Building {
  id: string;
  name: string;
  location?: string;
  notes?: string;
  imageUrl?: string; // Optional image for building
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: 'available' | 'booked' | 'maintenance';
  imageUrl?: string;
  description?: string;
  buildingId?: string;
  buildingName?: string;
  roomId?: string;
  roomName?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  status: 'available' | 'booked' | 'maintenance';
  imageUrl?: string;
  description?: string;
  amenities?: string[];
  category?: string; // e.g., Computer Room, Music Room
  buildingId?: string;
  buildingName?: string;
}

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'active';

export interface Reservation {
  id: string;
  userId: string;
  userName?: string; 
  userEmail?: string;
  itemId: string; 
  itemName?: string; 
  itemType: 'device' | 'room';
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  notes?: string;
  purpose?: string; 
  bookedBy?: string; 
}

export type ReservationRequest = Omit<Reservation, 'id' | 'userId' | 'userName' | 'userEmail' | 'status'> & {
  userId?: string; 
};

export interface TimePeriod {
  name: string;
  label: string; 
  start: string; 
  end: string;   
}
