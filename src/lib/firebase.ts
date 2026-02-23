import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDiXKf8klQiKPHH1rlWE3P8VQ9qaxM3iik",
    authDomain: "blood-donation-c418e.firebaseapp.com",
    projectId: "blood-donation-c418e",
    storageBucket: "blood-donation-c418e.firebasestorage.app",
    messagingSenderId: "189344130619",
    appId: "1:189344130619:web:da83db0bac8d78a999de1e",
    measurementId: "G-E97WNYHKK3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
