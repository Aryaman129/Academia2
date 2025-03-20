"use client"
import React from "react"
import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import LoadingIndicator from "./LoadingIndicator"

// Create axios instance with proper config
const api = axios.create({
  baseURL: "http://localhost:5050",
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
  const navigate = useNavigate()


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
  
      setMessage("Logging in...");
      const response = await api.post("/api/login", { email, password });
  
      if (!response.data.success) {
        throw new Error(response.data.error || "Login failed");
      }
  
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userEmail", response.data.user.email);
      localStorage.setItem("userId", response.data.user.id);
  
      setMessage("Login successful! Starting attendance scraper...");
  
      // Poll for scraper status **instead of waiting on login response**
      let attempts = 0;
      const maxAttempts = 20; // 100 seconds total
      const pollInterval = setInterval(async () => {
        attempts++;
        const status = await api.get("/api/scraper-status", {
          headers: { Authorization: `Bearer ${response.data.token}` },
        });
  
        if (status.data.status.status === "completed") {
          clearInterval(pollInterval);
          setMessage("Data retrieved successfully! Redirecting...");
          setTimeout(() => navigate("/dashboard"), 1000);
        } else if (status.data.status.status === "failed") {
          clearInterval(pollInterval);
          throw new Error("Failed to retrieve attendance data");
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setMessage("Taking longer than expected. Redirecting to dashboard...");
          setTimeout(() => navigate("/dashboard"), 1000);
        }
      }, 5050);
    } catch (error) {
      console.error("Auth error:", error);
      setError(error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };
  
  

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to see your attendance records</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-red-600 text-sm text-center">{error}</div>}

          {message && <div className="text-blue-600 text-sm text-center">{message}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? <LoadingIndicator /> : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Auth












