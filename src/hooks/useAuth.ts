// ═══════════════════════════════════════════════════════════
// 🔐 HOOK useAuth - RiderTrack V2
// Maneja el estado de autenticación del usuario
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, auth, db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  nombre: string;
  email: string;
  foto?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Escuchar cambios de auth
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Crear perfil básico
        setProfile({
          uid: firebaseUser.uid,
          nombre: firebaseUser.displayName || 'Repartidor',
          email: firebaseUser.email || '',
          foto: firebaseUser.photoURL || undefined,
        });

        // Escuchar datos del usuario en Firestore
        if (db) {
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          onSnapshot(
            userDocRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                setProfile({
                  uid: firebaseUser.uid,
                  nombre: data.nombre || firebaseUser.displayName || 'Repartidor',
                  email: data.email || firebaseUser.email || '',
                  foto: data.foto || firebaseUser.photoURL || undefined,
                });
              }
            },
            (err) => {
              console.warn('Error leyendo perfil:', err);
            }
          );
        }
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, profile, loading, auth, db };
}
