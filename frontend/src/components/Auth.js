"use client"
import React, { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"
import "./Auth.css" // We'll create this file next

// Create axios instance with proper config
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('LOCAL_API_URL:', process.env.REACT_APP_LOCAL_API_URL);
console.log('API_URL:', process.env.REACT_APP_API_URL);

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'development' 
    ? process.env.REACT_APP_LOCAL_API_URL 
    : process.env.REACT_APP_API_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
})

console.log('Using API URL:', api.defaults.baseURL);

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
  const [showPassword, setShowPassword] = useState(false)
  const [revealedChars, setRevealedChars] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [logoVisible, setLogoVisible] = useState(false)
  const [activeInput, setActiveInput] = useState(null)
  const navigate = useNavigate()
  const emailSuffix = "@srmist.edu.in"

  useEffect(() => {
    // Animate logo after page load
    setTimeout(() => {
      setLogoVisible(true)
    }, 300)
    
    // Create particles effect
    createParticles()
  }, [])
  
  const createParticles = () => {
    const particlesContainer = document.createElement('div')
    particlesContainer.className = 'particles'
    
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      
      // Random size between 5px and 15px
      const size = Math.random() * 10 + 5
      particle.style.width = `${size}px`
      particle.style.height = `${size}px`
      
      // Random position
      particle.style.left = `${Math.random() * 100}%`
      particle.style.top = `${Math.random() * 100}%`
      
      // Random animation duration between 15s and 30s
      const duration = Math.random() * 15 + 15
      particle.style.animationDuration = `${duration}s`
      
      // Random animation delay
      particle.style.animationDelay = `${Math.random() * 5}s`
      
      // Add to container
      particlesContainer.appendChild(particle)
    }
    
    document.querySelector('.login-container').appendChild(particlesContainer)
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

  // Handle email input change
  const handleEmailChange = (e) => {
    let value = e.target.value.toLowerCase()
    
    // Remove the suffix if it's already there
    if (value.endsWith(emailSuffix)) {
      value = value.slice(0, -emailSuffix.length)
    }
    
    // Remove any @ symbols the user types
    value = value.replace(/@/g, '')
    
    // Set the email state with just the username part
    setEmail(value)
  }

  // Get the full email with suffix
  const getFullEmail = () => `${email}${emailSuffix}`

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
  
    try {
      if (!email || !password) {
        throw new Error("Email and password are required")
      }
      
      const fullEmail = getFullEmail();
      
      console.log("Login attempt with:", { email: fullEmail });
  
      const response = await api.post("/api/login", { 
        email: fullEmail, 
        password 
      });
  
      // Check if response or response.data is undefined
      if (!response || !response.data) {
        throw new Error("Invalid server response");
      }
  
      if (!response.data.success) {
        throw new Error(response.data.error || "Login failed")
      }
  
      // Check if token and user exist before using them
      if (!response.data.token) {
        throw new Error("No authorization token received");
      }
  
      // Safe access to user data
      const userData = response.data.user || {};
  
      localStorage.setItem("token", response.data.token)
      localStorage.setItem("userEmail", userData.email || fullEmail)
      localStorage.setItem("userId", userData.id || "")
  
      // Start polling for scraper status
      let statusChecks = 0
      const maxStatusChecks = 60 // ~2 minutes of checking
      
      const checkStatus = async () => {
        try {
          statusChecks++
          if (statusChecks > maxStatusChecks) {
            // If we exceed max checks, just move on
            setTimeout(() => {
              navigate("/dashboard")
            }, 500)
            return
          }
          
          const statusResponse = await api.get("/api/scraper-status", {
            headers: { Authorization: `Bearer ${response.data.token}` },
          })
          
          // Safe object access
          const status = statusResponse?.data?.status?.status;
          
          if (status === "completed") {
            // If scraping is complete, navigate to dashboard
            setTimeout(() => {
              navigate("/dashboard")
            }, 500)
          } else if (status === "failed") {
            // If scraping failed but login succeeded, still navigate
            setTimeout(() => {
              navigate("/dashboard")
            }, 500)
          } else {
            // Otherwise, check again after a delay
            setTimeout(checkStatus, 2000)
          }
        } catch (error) {
          console.error("Status check error:", error);
          // If there's an error checking status, just navigate
          setTimeout(() => {
            navigate("/dashboard")
          }, 500)
        }
      }
      
      // Start status checking
      checkStatus()
    } catch (error) {
      console.error("Auth error:", error)
      setError(error.message || "An error occurred during login")
      setLoading(false)
    }
  }

  // Add reveal animation function
  const togglePasswordVisibility = () => {
    if (!showPassword) {
      // When showing password, reveal each character one by one
      setShowPassword(true)
      const chars = password.split('')
      setRevealedChars([])
      chars.forEach((_, index) => {
        setTimeout(() => {
          setRevealedChars(prev => [...prev, index])
        }, index * 30) // 0.03 second (30ms) delay between each character
      })
    } else {
      // When hiding password, reset immediately
      setShowPassword(false)
      setRevealedChars([])
    }
  }

  return (
    <div className="login-container">
      <div className="login-background"></div>
      
      {/* Animated Boxes */}
      <div className="box"></div>
      <div className="box"></div>
      <div className="box"></div>
      
      <div className="login-card-container">
        <div className="login-card">
          <h1>Acadia Student Portal</h1>
          <p className="version-text">(Testing Version)</p>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email" className="floating-label">Email address</label>
              <div className="email-input-wrapper">
                <input
                  id="email"
                  type="text"
                  required
                  placeholder=" "
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={() => setActiveInput('email')}
                  onBlur={() => setActiveInput(null)}
                />
                <span className="email-suffix">{emailSuffix}</span>
              </div>
            </div>

            <div className="form-group">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder=" "
                value={!showPassword ? password : ''}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveInput('password')}
                onBlur={() => setActiveInput(null)}
                className="password-input"
              />
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg
                  className={`eye-icon ${showPassword ? 'eye-open' : 'eye-closed'}`}
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                  {!showPassword && (
                    <line x1="2" y1="2" x2="22" y2="22"></line>
                  )}
                </svg>
              </button>
              {showPassword && (
                <div className="password-reveal-text">
                  {password.split('').map((char, index) => (
                    <span
                      key={index}
                      style={{ 
                        visibility: revealedChars.includes(index) ? 'visible' : 'hidden',
                        color: '#ffffff'
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="login-button"
            >
              Sign In
            </button>
          </form>
          
          {loading && <LoadingIndicator message="Checking your credentials..." />}
        </div>
      </div>
    </div>
  )
}

export default Auth












