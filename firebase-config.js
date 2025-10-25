// Firebase configuration and initialization
// Using Firebase CDN version (v9 compat mode)

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8Zu1N4i5TWLuhxNXLeshHEx7L8YgJtMY",
  authDomain: "amandaspetservices-55506.firebaseapp.com",
  projectId: "amandaspetservices-55506",
  storageBucket: "amandaspetservices-55506.firebasestorage.app",
  messagingSenderId: "607236264143",
  appId: "1:607236264143:web:13037356fbc94e53be27ba",
  measurementId: "G-GXMP781LN1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Analytics
const analytics = firebase.analytics();

// Optional: Log that Firebase is initialized
console.log("Firebase initialized successfully");

// Export for use in other scripts if needed
window.firebaseApp = firebase.app();
window.analytics = analytics;