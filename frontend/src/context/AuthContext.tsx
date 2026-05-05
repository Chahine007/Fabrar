import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getToken, setToken as saveToken, clearToken } from '../lib/api';
import type { DecodedAuthToken, UserData } from '../types/auth';

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const token = getToken();
      if (token) {
        try {
          const decoded = jwtDecode<DecodedAuthToken>(token);
          // Check expiration
          if (decoded.exp && Date.now() / 1000 > decoded.exp) {
            clearToken();
            setUser(null);
          } else {
            // Restore user data from token payload
            setUser({
              id: decoded.id,
              username: decoded.username,
              role: decoded.role,
              employee_id: decoded.employee_id,
            });
          }
        } catch (error) {
          console.error("Invalid token during initialization", error);
          clearToken();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (token: string, userData: UserData) => {
    saveToken(token);
    setUser(userData);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
