import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App;

function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }

  // Parse the private key - handle escaped newlines
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!privateKey) {
    throw new Error("FIREBASE_ADMIN_PRIVATE_KEY is not set");
  }

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });

  return adminApp;
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

export async function verifyIdToken(token: string) {
  const auth = getAdminAuth();
  try {
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.error("Error verifying ID token:", error);
    return null;
  }
}

export async function verifySessionCookie(sessionCookie: string) {
  const auth = getAdminAuth();
  try {
    return await auth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error("Error verifying session cookie:", error);
    return null;
  }
}

export async function createSessionCookie(idToken: string, expiresIn: number = 60 * 60 * 24 * 5 * 1000) {
  const auth = getAdminAuth();
  try {
    return await auth.createSessionCookie(idToken, { expiresIn });
  } catch (error) {
    console.error("Error creating session cookie:", error);
    return null;
  }
}
