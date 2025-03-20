"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authAPI } from "@/utils/api-client"

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("token")
    const userEmail = localStorage.getItem("userEmail")
    const userId = localStorage.getItem("userId")

    if (token && userEmail && userId) {
      setUser({ id: userId, email: userEmail })
      setIsLoading(false)
    } else {
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await authAPI.login(email, password)

      if (response.data.success) {
        const { token, user } = response.data

        // Store auth data in localStorage
        localStorage.setItem("token", token)
        localStorage.setItem("userEmail", user.email)
        localStorage.setItem("userId", user.id)
        localStorage.setItem("userPassword", password) // Needed for timetable refresh

        setUser(user)
        router.push("/dashboard")
      } else {
        setError(response.data.error || "Login failed")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred during login")
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userId")
    localStorage.removeItem("userPassword")
    setUser(null)
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

