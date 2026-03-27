import React, { createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsDemo: () => void;
}

const mockUser = { id: 'admin', email: 'admin@saude360.com' } as User;
const mockSession = { access_token: 'admin-token' } as Session;

const AuthContext = createContext<AuthContextType>({
  user: mockUser,
  session: mockSession,
  loading: false,
  signOut: async () => {},
  signInAsDemo: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{
      user: mockUser,
      session: mockSession,
      loading: false,
      signOut: async () => {},
      signInAsDemo: () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
