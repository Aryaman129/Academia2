"use client"
import React from "react"
import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import "./Auth.css" // We'll create this file next

// Create axios instance with proper config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5050",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error)
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timed out. Server might be busy.")
    }
    if (!error.response) {
      throw new Error("Cannot connect to server. Please try again later.")
    }
    throw error
  },
)

const Auth = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [showLogo, setShowLogo] = useState(false)
  const [activeInput, setActiveInput] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Fade in logo after a short delay
    const timer = setTimeout(() => {
      setShowLogo(true)
    }, 300)
    
    // Create particles
    createParticles()
    
    return () => clearTimeout(timer)
  }, [])
  
  // Create floating particles for background effect
  const createParticles = () => {
    const container = document.querySelector('.login-container')
    if (!container) return
    
    const particlesContainer = document.createElement('div')
    particlesContainer.className = 'particles'
    container.appendChild(particlesContainer)
    
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      
      // Random position, size and animation
      const size = Math.random() * 10 + 3
      const posX = Math.random() * 100
      const posY = Math.random() * 100
      const animationDuration = Math.random() * 10 + 10
      const animationDelay = Math.random() * 5
      
      particle.style.width = `${size}px`
      particle.style.height = `${size}px`
      particle.style.left = `${posX}%`
      particle.style.top = `${posY}%`
      particle.style.opacity = Math.random() * 0.5 + 0.2
      particle.style.animation = `float ${animationDuration}s ease-in-out ${animationDelay}s infinite`
      
      particlesContainer.appendChild(particle)
    }
  }

  // Check if server is healthy
  const checkServerHealth = useCallback(async () => {
    try {
      const response = await api.get("/health")
      return response.data.status === "healthy"
    } catch (error) {
      console.error("Health check failed:", error)
      return false
    }
  }, [])

  // Check scraper status
  const checkScraperStatus = useCallback(async (token) => {
    try {
      const response = await api.get("/api/scraper-status", {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.status
    } catch (error) {
      console.error("Failed to check scraper status:", error)
      return { status: "failed" }
    }
  }, [])

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
  
    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
  
      const response = await api.post("/api/login", { email, password });
  
      if (!response.data.success) {
        throw new Error(response.data.error || "Login failed");
      }
  
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userEmail", response.data.user.email);
      localStorage.setItem("userId", response.data.user.id);
  
      // Poll for scraper status - keep this silent now that we use LoadingIndicator
      let attempts = 0;
      const maxAttempts = 20; // 100 seconds total
      const pollInterval = setInterval(async () => {
        attempts++;
        const status = await api.get("/api/scraper-status", {
          headers: { Authorization: `Bearer ${response.data.token}` },
        });
  
        if (status.data.status.status === "completed") {
          clearInterval(pollInterval);
          setLoading(false);
          setTimeout(() => navigate("/dashboard"), 500);
        } else if (status.data.status.status === "failed") {
          clearInterval(pollInterval);
          throw new Error("Failed to retrieve your data");
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setLoading(false);
          setTimeout(() => navigate("/dashboard"), 500);
        }
      }, 5050);
    } catch (error) {
      console.error("Auth error:", error);
      setError(error.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-card-container">
        <div className={`srm-logo ${showLogo ? 'visible' : ''}`}>
          <div className="academia-title">
            <h2 className="text-3xl font-extrabold text-white">Academia</h2>
            <div className="version-badge">(Testing Version)</div>
          </div>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h2 className="text-2xl font-bold text-gray-800">Student Portal</h2>
            <p className="text-sm text-gray-600 mt-1">Sign in to see your attendance records</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <div className={`floating-label ${activeInput === 'email' || email ? 'active' : ''}`}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setActiveInput('email')}
                  onBlur={() => setActiveInput(null)}
                />
                <label htmlFor="email">Email address</label>
              </div>
            </div>

            <div className="input-group">
              <div className={`floating-label ${activeInput === 'password' || password ? 'active' : ''}`}>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setActiveInput('password')}
                  onBlur={() => setActiveInput(null)}
                />
                <label htmlFor="password">Password</label>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="login-button-container">
              <button
                type="submit"
                disabled={loading}
                className="login-button"
              >
                <span className="button-text">Sign In</span>
                <span className="button-icon">→</span>
              </button>
            </div>
          </form>
          
          {loading && (
            <LoadingIndicator message="Checking your credentials..." />
          )}
          
          {!loading && message && (
            <div className="text-blue-600 text-sm text-center mt-4">{message}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Auth












