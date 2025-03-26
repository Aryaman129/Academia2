export const getStoredSession = async () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const response = await fetch('/api/verify-session', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}; 