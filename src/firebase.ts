import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCAQ9t4-C0AFT3tLzChoPMO2TGsoNfgH2w",
  authDomain: "vortex-07-bot.firebaseapp.com",
  projectId: "vortex-07-bot",
  storageBucket: "vortex-07-bot.firebasestorage.app",
  messagingSenderId: "749897311897",
  appId: "1:749897311897:web:c4a962d3d63ae5e2d97a08"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Custom firestore database ID passed as third parameter of initializeFirestore to map with the correct database rules
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "ai-studio-15fe54c3-7a95-4415-a2b9-afdf6826e6cb");

export { app, auth, db };
