// ═══════════════════════════════════════════════════════════
// 🔥 FIREBASE CONFIG - RiderTrack V2
// Proyecto: ridertrack-93c8a (mismo que Modular y RiderChat)
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAzDl7gaS40JoXt9OoCPzG9FyaVPz_O34I",
  authDomain: "ridertrack-93c8a.firebaseapp.com",
  projectId: "ridertrack-93c8a",
  storageBucket: "ridertrack-93c8a.firebasestorage.app",
  messagingSenderId: "851606828420",
  appId: "1:851606828420:web:873a892a091394693e59d1"
};

// Inicializar Firebase
let app;
let auth;
let db;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);

  // Detectar APK (Capacitor) para usar long polling
  const isAPK = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNative;
  if (isAPK) {
    console.log('📱 APK detectado - usando long polling');
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } else {
    db = getFirestore(app);
  }

  console.log('✅ Firebase inicializado:', firebaseConfig.projectId);
} catch (e) {
  console.error('❌ Error inicializando Firebase:', e);
}

export { app, auth, db };
export { GoogleAuthProvider };

// ═══════════════════════════════════════════════════════════
// 🔐 FUNCIONES DE AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════

// Login con Google (web - popup)
export async function loginConGoogleWeb() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Login con Google (APK - Capacitor GoogleAuth)
export async function loginConGoogleAPK(googleUser: any) {
  try {
    const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
    const result = await signInWithCredential(auth, credential);
    return { success: true, user: result.user };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Login con email y contraseña
export async function loginConEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (e: any) {
    let msg = 'Error al iniciar sesión';
    if (e.code === 'auth/user-not-found') msg = 'No existe cuenta con ese email';
    if (e.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
    if (e.code === 'auth/invalid-email') msg = 'Email inválido';
    if (e.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera unos minutos';
    return { success: false, error: msg };
  }
}

// Registrar con email y contraseña
export async function registrarConEmail(email: string, password: string, nombre: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Guardar nombre en el perfil
    await result.user.updateProfile({ displayName: nombre });
    // Guardar datos en Firestore
    await setDoc(doc(db, 'usuarios', result.user.uid), {
      nombre: nombre,
      email: email,
      createdAt: serverTimestamp(),
    });
    return { success: true, user: result.user };
  } catch (e: any) {
    let msg = 'Error al registrar';
    if (e.code === 'auth/email-already-in-use') msg = 'Ya existe una cuenta con ese email';
    if (e.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres';
    return { success: false, error: msg };
  }
}

// Recuperar contraseña
export async function recuperarPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (e: any) {
    let msg = 'Error al enviar email';
    if (e.code === 'auth/user-not-found') msg = 'No existe cuenta con ese email';
    if (e.code === 'auth/invalid-email') msg = 'Email inválido';
    return { success: false, error: msg };
  }
}

// Cerrar sesión
export async function cerrarSesion() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Escuchar cambios de auth
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
