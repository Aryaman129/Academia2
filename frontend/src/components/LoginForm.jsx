"use client"
import React from "react"
import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const API_URL = "http://localhost:5000"

const LoginForm = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("Logging in...")

    try {
      const response = await axios.post(`${API_URL}/login`, {
        email,
        password,
      })

      if (response.data.success) {
        setMessage("Login successful! Scraping attendance data...")

        // Store token and user info in localStorage
        localStorage.setItem("token", response.data.token)
        localStorage.setItem("user", JSON.stringify(response.data.user))

        // Wait a bit to allow scraper to start
        setTimeout(() => {
          setMessage("Redirecting to dashboard...")
          navigate("/dashboard")
        }, 2000)
      } else {
        setError(response.data.error || "Login failed")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError(err.response?.data?.error || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Login to Academia</h2>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {message && <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded">{message}</div>}

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Processing..." : "Login"}
        </button>
      </form>
    </div>
  )
}

export default LoginForm

