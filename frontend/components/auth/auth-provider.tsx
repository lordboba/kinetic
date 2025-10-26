"use client";

import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getClientAuth,
  isFirebaseConfigValid,
} from "@/lib/firebaseClient";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const firebaseConfigReady = isFirebaseConfigValid();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseConfigReady);

  useEffect(() => {
    if (!firebaseConfigReady) {
      console.warn(
        "Firebase environment variables are missing. Authentication features are disabled until they are provided.",
      );
      return;
    }

    let unsub = () => {};

    const start = async () => {
      try {
        const auth = getClientAuth();
        unsub = onAuthStateChanged(auth, (firebaseUser) => {
          setUser(firebaseUser);
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    start();

    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut: async () => {
        const auth = getClientAuth();
        await firebaseSignOut(auth);
        setUser(null);
      },
      getIdToken: async () => {
        if (!user) {
          throw new Error("No user is signed in");
        }
        return await user.getIdToken();
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
