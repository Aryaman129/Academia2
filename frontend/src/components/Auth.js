"use client"
import React, { useState, useEffect, useRef, useCallback } from "react"
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
  const [logoVisible, setLogoVisible] = useState(false)
  const [activeInput, setActiveInput] = useState(null)
  const navigate = useNavigate()

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
  
      const response = await api.post("/api/login", { email, password })
  
      if (!response.data.success) {
        throw new Error(response.data.error || "Login failed")
      }
  
      localStorage.setItem("token", response.data.token)
      localStorage.setItem("userEmail", response.data.user.email)
      localStorage.setItem("userId", response.data.user.id)
  
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
          
          if (statusResponse.data.status.status === "completed") {
            // If scraping is complete, navigate to dashboard
            setTimeout(() => {
              navigate("/dashboard")
            }, 500)
          } else if (statusResponse.data.status.status === "failed") {
            // If scraping failed but login succeeded, still navigate
            setTimeout(() => {
              navigate("/dashboard")
            }, 500)
          } else {
            // Otherwise, check again after a delay
            setTimeout(checkStatus, 2000)
          }
        } catch (error) {
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

  return (
    <div className="login-container">
      <div className="login-background"></div>
      
      {/* Animated Boxes */}
      <div className="box"></div>
      <div className="box"></div>
      <div className="box"></div>
      
      <div className="login-card-container">
        <div className={`srm-logo ${logoVisible ? 'visible' : ''}`}>
          <div className="academia-title">
            <h2 className="text-3xl font-extrabold text-white">Academia</h2>
            <div className="version-badge">(Testing Version)</div>
          </div>
        </div>

        <div className="login-card">
          <h1>Academia Student Portal</h1>
          <p>(Testing Version)</p>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setActiveInput('email')}
                onBlur={() => setActiveInput(null)}
              />
              <label htmlFor="email">Email address</label>
            </div>

            <div className="form-group">
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveInput('password')}
                onBlur={() => setActiveInput(null)}
              />
              <label htmlFor="password">Password</label>
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












