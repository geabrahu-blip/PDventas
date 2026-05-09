import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// Fallback to hardcoded values to prevent white screen in deployments
// without environment variables configured. Firebase config for the web is safe to be public.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAfyVb2Ib9llKot1iAckcOLfedv5nCJcmY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pieldivina-8e167.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pieldivina-8e167",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pieldivina-8e167.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "414757799407",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:414757799407:web:59c41b8504469176ea221a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
