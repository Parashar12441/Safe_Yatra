// ═══ FIREBASE CONFIGURATION ═══════════════════════════════════════════════════
firebase.initializeApp({
  apiKey: "AIzaSyBWN0kJn_pkakvVGULCPi9JOzcmVIkoo6Y",
  authDomain: "safe-yatra-157c7.firebaseapp.com",
  projectId: "safe-yatra-157c7",
  storageBucket: "safe-yatra-157c7.firebasestorage.app",
  messagingSenderId: "838865526723",
  appId: "1:838865526723:web:d66cfeaa1eb3411d0ae776",
  measurementId: "G-5DGJ7PY8H1"
});
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
