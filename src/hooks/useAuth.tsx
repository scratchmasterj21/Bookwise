
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '@/lib/firebase'; // Added db
import type { User } from '@/types';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firebase SDK imports

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "YOUR_ADMIN_USER_UID_REPLACE_ME"; 

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        let appUser: User;

        if (userSnap.exists()) {
          const userData = userSnap.data();
          appUser = {
            ...userData,
            uid: firebaseUser.uid, // ensure uid is present
            // Convert Firestore Timestamps to JS Dates if necessary, e.g., for createdAt
            createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : userData.createdAt,
          } as User;
          
          if (typeof appUser.isAdmin === 'undefined') {
            appUser.isAdmin = firebaseUser.uid === ADMIN_UID;
            // await setDoc(userRef, { isAdmin: appUser.isAdmin }, { merge: true }); // Potentially update if missing
          }
        } else {
          // New user, create profile in Firestore
          const initialIsAdmin = firebaseUser.uid === ADMIN_UID;
          appUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            isAdmin: initialIsAdmin,
            createdAt: new Date(), // Use JS Date, Firestore will convert to Timestamp
          };
          await setDoc(userRef, {
            ...appUser,
            createdAt: serverTimestamp() // Use serverTimestamp for consistent creation time
          });
          appUser.createdAt = new Date(); // For local state consistency immediately
        }
        
        setUser(appUser);
        setIsAdmin(appUser.isAdmin || false);

      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard'); 
    } catch (error) {
      console.error("Error signing in with Google: ", error);
      setLoading(false); 
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    } 
    // setLoading(false) is handled by onAuthStateChanged
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
