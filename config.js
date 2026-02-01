// config.js
console.log("1. Loading Config...");

const firebaseConfig = {
    apiKey: "AIzaSyBup3s_Z3nVZU-O5da0owglWaFXh5Fpfdg",
  authDomain: "customise-previews.firebaseapp.com",
  projectId: "customise-previews",
  storageBucket: "customise-previews.firebasestorage.app",
  messagingSenderId: "1073406972228",
  appId: "1:1073406972228:web:71ee5db786b2fe2af40711"
};

try {
    firebase.initializeApp(firebaseConfig);
    
    // ATTACH TO WINDOW TO MAKE GLOBALLY ACCESSIBLE
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    
    console.log("✅ Firebase Initialized & Attached to Window");
} catch (e) {
    console.error("❌ Config Error:", e);
    alert("Firebase Config Failed: " + e.message);
}
