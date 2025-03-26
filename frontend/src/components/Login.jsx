import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [isQuickLogin, setIsQuickLogin] = useState(true);
  
  const navigate = useNavigate();
  
  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setCheckingSession(false);
        return;
      }
      
      try {
        const response = await fetch('https://academia2-1.onrender.com/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Token is valid, redirect to dashboard
          navigate('/dashboard');
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('token');
          setCheckingSession(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, [navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('https://academia2-1.onrender.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store token in localStorage
        localStorage.setItem('token', data.token);
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setMessage(data.error || 'Login failed');
      }
    } catch (error) {
      setMessage('Server error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const tryQuickLogin = async () => {
    try {
      const response = await fetch('/api/quick-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        // Existing session found, use it
        const data = await response.json();
        localStorage.setItem('token', data.token);
        // Redirect to dashboard
        return true;
      } else {
        // Need full login
        setIsQuickLogin(false);
        return false;
      }
    } catch (error) {
      console.error('Quick login failed:', error);
      setIsQuickLogin(false);
      return false;
    }
  };
  
  if (checkingSession) {
    return <div>Checking session...</div>;
  }
  
  return (
    <div>
      <h2>Login</h2>
      {message && <div className="error">{message}</div>}
      <form onSubmit={handleLogin}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {!isQuickLogin && (
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login; 