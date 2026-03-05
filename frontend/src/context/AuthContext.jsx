import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [manager, setManager] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ld_token'));

  useEffect(() => {
    const stored = localStorage.getItem('ld_manager');
    if (stored) {
      try { setManager(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  function login(managerData, jwt) {
    setManager(managerData);
    setToken(jwt);
    localStorage.setItem('ld_token', jwt);
    localStorage.setItem('ld_manager', JSON.stringify(managerData));
  }

  function logout() {
    setManager(null);
    setToken(null);
    localStorage.removeItem('ld_token');
    localStorage.removeItem('ld_manager');
  }

  return (
    <AuthContext.Provider value={{ manager, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
