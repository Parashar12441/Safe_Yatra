// ═══ FIREBASE CONFIGURATION ═══════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBWN0kJn_pkakvVGULCPi9JOzcmVIkoo6Y",
  authDomain: "safe-yatra-157c7.firebaseapp.com",
  projectId: "safe-yatra-157c7",
  storageBucket: "safe-yatra-157c7.firebasestorage.app",
  messagingSenderId: "838865526723",
  appId: "1:838865526723:web:fb1ba058a39573e00ae776",
  measurementId: "G-6Q94RMDD76"
};

// Initialize Firebase using the Compat SDK
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ═══ SUPABASE CONFIGURATION ═══════════════════════════════════════════════════
// TODO: Replace with your actual Supabase URL and anon/public key
const SUPABASE_URL = "https://juwquonefwyexclbtxqa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__siVejaDY-hYof1zsUBMog_Zyvrz2kI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);