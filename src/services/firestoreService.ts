
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  FirestoreDataConverter,
  DocumentSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Building, Room, Device, Reservation, User } from '@/types';


// --- User Operations ---
export const getUserProfile = async (userId: string): Promise<User | null> => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        return {
            ...userData,
            uid: userId,
            createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : userData.createdAt,
        } as User;
    }
    return null;
};


// --- Converters ---
const buildingConverter: FirestoreDataConverter<Building> = {
  toFirestore(building: Omit<Building, 'id'>): DocumentData {
    const data: DocumentData = { name: building.name, numberOfFloors: building.numberOfFloors };
    if (building.location) data.location = building.location;
    if (building.notes) data.notes = building.notes;
    if (building.imageUrl) data.imageUrl = building.imageUrl;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Building {
    const data = snapshot.data()!;
    return {
      id: snapshot.id,
      name: data.name,
      numberOfFloors: data.numberOfFloors,
      location: data.location,
      notes: data.notes,
      imageUrl: data.imageUrl,
    } as Building;
  }
};

const roomConverter: FirestoreDataConverter<Room> = {
  toFirestore(room: Omit<Room, 'id'>): DocumentData {
    const data: DocumentData = {
      name: room.name,
      capacity: room.capacity,
      status: room.status,
      buildingId: room.buildingId,
      buildingName: room.buildingName,
      floorNumber: room.floorNumber,
    };
    if (room.imageUrl) data.imageUrl = room.imageUrl;
    if (room.description) data.description = room.description;
    if (room.amenities) data.amenities = room.amenities;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Room {
    const data = snapshot.data()!;
    return {
      id: snapshot.id,
      ...data,
    } as Room;
  }
};

const deviceConverter: FirestoreDataConverter<Device> = {
  toFirestore(device: Omit<Device, 'id'>): DocumentData {
     const data: DocumentData = {
      name: device.name,
      type: device.type,
      status: device.status,
      quantity: device.quantity,
    };
    if (device.imageUrl) data.imageUrl = device.imageUrl;
    if (device.description) data.description = device.description;
    if (device.buildingId) data.buildingId = device.buildingId;
    if (device.buildingName) data.buildingName = device.buildingName;
    if (device.roomId) data.roomId = device.roomId;
    if (device.roomName) data.roomName = device.roomName;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Device {
    const data = snapshot.data()!;
    return {
      id: snapshot.id,
      ...data,
    } as Device;
  }
};

const reservationConverter: FirestoreDataConverter<Reservation> = {
  toFirestore(reservation: Omit<Reservation, 'id'>): DocumentData {
    const data: DocumentData = {
      userId: reservation.userId,
      itemId: reservation.itemId,
      itemType: reservation.itemType,
      startTime: Timestamp.fromDate(new Date(reservation.startTime)),
      endTime: Timestamp.fromDate(new Date(reservation.endTime)),
      status: reservation.status,
    };
    if (reservation.userName) data.userName = reservation.userName;
    if (reservation.userEmail) data.userEmail = reservation.userEmail;
    if (reservation.itemName) data.itemName = reservation.itemName;
    if (reservation.notes) data.notes = reservation.notes;
    if (reservation.purpose) data.purpose = reservation.purpose;
    if (reservation.bookedBy) data.bookedBy = reservation.bookedBy;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Reservation {
    const data = snapshot.data()!;
    return {
      id: snapshot.id,
      ...data,
      startTime: (data.startTime as Timestamp).toDate(),
      endTime: (data.endTime as Timestamp).toDate(),
    } as Reservation;
  }
};


// --- Building Operations ---
export const addBuilding = async (buildingData: Omit<Building, 'id'>): Promise<Building> => {
  const buildingsCol = collection(db, 'buildings').withConverter(buildingConverter);
  const docRef = await addDoc(buildingsCol, buildingData);
  const newDocSnap = await getDoc(docRef.withConverter(buildingConverter));
  if (!newDocSnap.exists()) throw new Error("Failed to create building");
  return newDocSnap.data()!;
};

export const getBuildings = async (): Promise<Building[]> => {
  const buildingsCol = collection(db, 'buildings').withConverter(buildingConverter);
  const snapshot = await getDocs(buildingsCol);
  return snapshot.docs.map(doc => doc.data());
};

export const updateBuilding = async (buildingId: string, buildingData: Partial<Omit<Building, 'id'>>): Promise<void> => {
  const buildingRef = doc(db, 'buildings', buildingId).withConverter(buildingConverter);
  await updateDoc(buildingRef, buildingData);
};

export const deleteBuilding = async (buildingId: string): Promise<void> => {
  const buildingRef = doc(db, 'buildings', buildingId);
  await deleteDoc(buildingRef);
};

// --- Room Operations ---
export const addRoom = async (roomData: Omit<Room, 'id'>): Promise<Room> => {
  const roomsCol = collection(db, 'rooms').withConverter(roomConverter);
  const docRef = await addDoc(roomsCol, roomData);
  const newDocSnap = await getDoc(docRef.withConverter(roomConverter));
  if (!newDocSnap.exists()) throw new Error("Failed to create room");
  return newDocSnap.data()!;
};

export const getRooms = async (buildingId?: string): Promise<Room[]> => {
  let q = query(collection(db, 'rooms'));
  if (buildingId) {
    q = query(q, where('buildingId', '==', buildingId));
  }
  const snapshot = await getDocs(q.withConverter(roomConverter));
  return snapshot.docs.map(doc => doc.data());
};

export const updateRoom = async (roomId: string, roomData: Partial<Omit<Room, 'id'>>): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomId).withConverter(roomConverter);
  await updateDoc(roomRef, roomData);
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomId);
  await deleteDoc(roomRef);
};

// --- Device Operations ---
export const addDevice = async (deviceData: Omit<Device, 'id'>): Promise<Device> => {
  const devicesCol = collection(db, 'devices').withConverter(deviceConverter);
  const docRef = await addDoc(devicesCol, deviceData);
  const newDocSnap = await getDoc(docRef.withConverter(deviceConverter));
  if (!newDocSnap.exists()) throw new Error("Failed to create device");
  return newDocSnap.data()!;
};

export const getDevices = async (roomId?: string, buildingId?: string): Promise<Device[]> => {
  let q = query(collection(db, 'devices'));
  if (roomId) {
    q = query(q, where('roomId', '==', roomId));
  } else if (buildingId) {
    q = query(q, where('buildingId', '==', buildingId));
  }
  const snapshot = await getDocs(q.withConverter(deviceConverter));
  return snapshot.docs.map(doc => doc.data());
};

export const updateDevice = async (deviceId: string, deviceData: Partial<Omit<Device, 'id'>>): Promise<void> => {
  const deviceRef = doc(db, 'devices', deviceId).withConverter(deviceConverter);
  await updateDoc(deviceRef, deviceData);
};

export const deleteDevice = async (deviceId: string): Promise<void> => {
  const deviceRef = doc(db, 'devices', deviceId);
  await deleteDoc(deviceRef);
};

// --- Reservation Operations ---
export const addReservation = async (reservationData: Omit<Reservation, 'id'>): Promise<Reservation> => {
  const reservationsCol = collection(db, 'reservations').withConverter(reservationConverter);
  const docRef = await addDoc(reservationsCol, reservationData);
  const newDocSnap = await getDoc(docRef.withConverter(reservationConverter));
  if (!newDocSnap.exists()) {
    throw new Error("Failed to create and retrieve reservation");
  }
  return newDocSnap.data()!;
};

export const getReservations = async (userId?: string, itemId?: string): Promise<Reservation[]> => {
  let q = query(collection(db, 'reservations'));
  const conditions = [];
  if (userId) {
    conditions.push(where('userId', '==', userId));
  }
  if (itemId) {
    conditions.push(where('itemId', '==', itemId));
  }
  
  if (conditions.length > 0) {
      q = query(collection(db, 'reservations'), ...conditions);
  } else {
      q = query(collection(db, 'reservations'));
  }
  // q = query(q, orderBy('startTime', 'desc')); // Removed default sort to allow page-specific sorting
  const snapshot = await getDocs(q.withConverter(reservationConverter));
  return snapshot.docs.map(doc => doc.data());
};

export const updateReservationStatus = async (reservationId: string, status: Reservation['status']): Promise<void> => {
  const reservationRef = doc(db, 'reservations', reservationId);
  await updateDoc(reservationRef, { status });
};

export const updateReservationPurpose = async (reservationId: string, purpose: string): Promise<void> => {
  const reservationRef = doc(db, 'reservations', reservationId);
  await updateDoc(reservationRef, { purpose });
};

export const cancelReservation = async (reservationId: string): Promise<void> => {
  await updateReservationStatus(reservationId, 'cancelled');
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
  const reservationRef = doc(db, 'reservations', reservationId);
  await deleteDoc(reservationRef);
};
