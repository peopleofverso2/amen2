import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';

const cleanEnvValue = (value: string | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const firebaseConfig = {
  apiKey: cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
};

export const isFirebaseGoogleLoginEnabled = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

const getFirebaseAuth = (): Auth => {
  if (!isFirebaseGoogleLoginEnabled) {
    throw new Error('Connexion Google non configurée pour ce déploiement');
  }

  if (!cachedApp) {
    cachedApp = initializeApp(firebaseConfig);
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }

  return cachedAuth;
};

export const loginWithGooglePopup = async (): Promise<string> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken(true);
  if (!idToken) {
    throw new Error('Token Google introuvable');
  }

  return idToken;
};
