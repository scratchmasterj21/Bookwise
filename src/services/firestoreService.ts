
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
  DocumentSnapshot
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
  toFirestore(building: Omit<Building, 'id'>): DocumentData { // Adjusted to Omit id for toFirestore
    return { ...building };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Building { // Allow DocumentSnapshot for getDoc
    const data = snapshot.data()!;
    return {
      id: snapshot.id,
      ...data,
    } as Building;
  }
};

const roomConverter: FirestoreDataConverter<Room> = {
  toFirestore(room: Omit<Room, 'id'>): DocumentData {
    return { ...room };
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
    return { ...device };
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
    return {
      ...reservation,
      startTime: Timestamp.fromDate(new Date(reservation.startTime)),
      endTime: Timestamp.fromDate(new Date(reservation.endTime)),
    };
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
  // Fetch the document to get the fully converted object with ID
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
  // TODO: Consider cascading deletes or warnings for rooms/devices in this building
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
  // TODO: Consider cascading deletes or warnings for devices in this room
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
  if (userId) {
    q = query(q, where('userId', '==', userId));
  }
  if (itemId) {
    q = query(q, where('itemId', '==', itemId));
  }
  // Add ordering if needed, e.g., by startTime
  // q = query(q, orderBy('startTime', 'desc'));
  const snapshot = await getDocs(q.withConverter(reservationConverter));
  return snapshot.docs.map(doc => doc.data());
};

export const updateReservationStatus = async (reservationId: string, status: Reservation['status']): Promise<void> => {
  const reservationRef = doc(db, 'reservations', reservationId);
  await updateDoc(reservationRef, { status });
};

export const cancelReservation = async (reservationId: string): Promise<void> => {
  await updateReservationStatus(reservationId, 'cancelled');
};
