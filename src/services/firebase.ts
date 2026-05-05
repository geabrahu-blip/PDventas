import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// Fallback to hardcoded values to prevent white screen in deployments
// without environment variables configured. Firebase config for the web is safe to be public.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB-Z-iOLagPr_lQMq87eQ_doqOLIfssxGs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inventario-perfumes.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inventario-perfumes",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inventario-perfumes.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "712235668233",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:712235668233:web:a616ad967df32199ff79d8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
