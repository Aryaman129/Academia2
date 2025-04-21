import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('userEmail');
    const userId = localStorage.getItem('userId');

    if (token && email) {
      setUser({
        email,
        id: userId || '',
        token
      });
    }

    setLoading(false);
  }, []);

  // Login function
  const login = (userData) => {
    // Store user data in localStorage
    localStorage.setItem('token', userData.token);
    localStorage.setItem('userEmail', userData.email);
    if (userData.id) {
      localStorage.setItem('userId', userData.id);
    }

    // Update state
    setUser({
      email: userData.email,
      id: userData.id || '',
      token: userData.token
    });
  };

  // Logout function
  const logout = () => {
    // Clear all authentication data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('userPassword');
    localStorage.removeItem('isLoggedIn');

    // Update state
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
