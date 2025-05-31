
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
}

export type DeviceType = 'Laptop' | 'Tablet' | 'Monitor' | 'Projector' | 'Other';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: 'available' | 'booked' | 'maintenance';
  imageUrl?: string;
  description?: string;
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
}

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'active';

export interface Reservation {
  id: string;
  userId: string;
  userName?: string; 
  userEmail?: string;
  itemId: string; // This will be the room ID
  itemName?: string; // Room name
  itemType: 'device' | 'room';
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  notes?: string;
  purpose?: string; // e.g., "G3B Computer Class", "G2 Music"
  bookedBy?: string; // e.g. "Limpiada", "Miyamae" - could be a teacher or department
}

// For forms
export type ReservationRequest = Omit<Reservation, 'id' | 'userId' | 'userName' | 'userEmail' | 'status'> & {
  userId?: string; // Optional during creation if context implies user
};

export interface TimePeriod {
  name: string;
  label: string; // e.g., "09:00 - 09:45"
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}
