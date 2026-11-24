import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * FreshSpin Firebase Web Configuration (Spark Free Plan)
 *
 * Values are provided via Vite environment variables (VITE_FIREBASE_*).
 * Firebase initializes only when a complete, valid configuration is present.
 */
const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' && process.env ? process.env : {})

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

// Verify that all vital configuration parameters exist and are not template placeholders
const isFirebaseAvailable = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  !firebaseConfig.apiKey.includes('your-firebase')
)

let app = null
let auth = null
let db = null

if (isFirebaseAvailable) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)
    db = getFirestore(app)
  } catch (error) {
    console.warn('[Firebase] Initialization error:', error)
  }
}

export { app, auth, db, isFirebaseAvailable }
export default app
