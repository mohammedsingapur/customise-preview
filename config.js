// config.js
console.log("1. Loading Config...");

// FIX: Use window.firebaseConfig instead of const to prevent crashes
window.firebaseConfig = {
    apiKey: "AIzaSyBup3s_Z3nVZU-O5da0owglWaFXh5Fpfdg",
  authDomain: "customise-previews.firebaseapp.com",
  projectId: "customise-previews",
  storageBucket: "customise-previews.firebasestorage.app",
  messagingSenderId: "1073406972228",
  appId: "1:1073406972228:web:71ee5db786b2fe2af40711"
};

try {
    // Check if initialized to prevent double-init
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    
    // Attach to window so app.js can find them
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    
    console.log("✅ Firebase Config Loaded");
} catch (e) {
    console.error("Config Error:", e);
    alert("Config Error: " + e.message);
}
