"use client"
import React from "react"
import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const Auth = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [isSignup, setIsSignup] = useState(false)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const endpoint = isSignup ? "/signup" : "/login"
      const payload = isSignup ? { email, password, registration_number: registrationNumber } : { email, password }

      const response = await axios.post(`http://localhost:5000${endpoint}`, payload)

      if (response.data.success) {
        // Store user data in localStorage
        localStorage.setItem("user_id", response.data.user.id)
        localStorage.setItem("email", response.data.user.email)
        localStorage.setItem("registration_number", response.data.user.registration_number)

        navigate("/dashboard")
      } else {
        setMessage(response.data.error || "Authentication failed")
      }
    } catch (error) {
      console.error("Auth error:", error)
      setMessage(error.response?.data?.error || "Something went wrong!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignup ? "Create your account" : "Sign in to your account"}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="SRM Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {isSignup && (
              <div>
                <input
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Registration Number"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>
            )}
          </div>

          {message && <div className="text-red-500 text-sm text-center">{message}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? "Please wait..." : isSignup ? "Sign Up" : "Sign In"}
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsSignup(!isSignup)
              setMessage("")
            }}
            className="text-indigo-600 hover:text-indigo-500"
          >
            {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth




