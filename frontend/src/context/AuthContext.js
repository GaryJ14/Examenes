import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper seguro para leer usuario desde localStorage
  const getStoredUser = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (err) {
      console.error('Usuario en localStorage corrupto, se limpiará.', err);
      localStorage.removeItem('user');
      return null;
    }
  };

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (correo_electronico, password) => {
    const data = await authService.login(correo_electronico, password);

    localStorage.setItem('access', data.access);
    localStorage.setItem('refresh', data.refresh);
    localStorage.setItem('user', JSON.stringify(data.usuario));

    setUser(data.usuario);
    return data;
  };

  const register = async (formData) => {
    return await authService.register(formData);
  };

  const logout = () => {
    setUser(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
