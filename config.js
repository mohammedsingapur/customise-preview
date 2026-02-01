// config.js
// Replace with your actual Firebase project keys
const firebaseConfig = {
    apiKey: "AIzaSyBup3s_Z3nVZU-O5da0owglWaFXh5Fpfdg",
    authDomain: "customise-previews.firebaseapp.com",
    projectId: "customise-previews",
    storageBucket: "customise-previews.firebasestorage.app",
    messagingSenderId: "1073406972228",
    appId: "1:1073406972228:web:71ee5db786b2fe2af40711"
};

// Initialize Firebase immediately
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
