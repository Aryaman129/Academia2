"use client";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; // ✅ Import axios for backend requests
import supabase from "../supabaseClient"; // ✅ Use correct Supabase client

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      let response;
      if (isSignup) {
        response = await supabase.auth.signUp({ email, password });
      } else {
        response = await supabase.auth.signInWithPassword({ email, password });
      }

      if (response.error) throw response.error;

      console.log("✅ Auth Success! Starting scraper...");
      
      // ✅ Call Backend to Trigger Scraper & Fetch Attendance Automatically
      setTimeout(async () => {
        try {
          const token = (await supabase.auth.getSession()).data?.session?.access_token;
          if (!token) throw new Error("Authentication failed");

          const attendanceResponse = await axios.get("http://localhost:5000/api/attendance", {
            headers: { Authorization: `Bearer ${token}` },
          });

          console.log("📌 Attendance Data:", attendanceResponse.data);
          navigate("/dashboard"); // ✅ Redirect after fetching attendance
        } catch (err) {
          console.error("❌ Error fetching attendance:", err);
        }
      }, 60000); // ✅ Wait 60 seconds for scraper to finish

    } catch (error) {
      console.error("Auth error:", error);
      setMessage(error.message || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          {isSignup ? "Create your account" : "Sign in to your account"}
        </h2>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {message && <div className="text-red-500 text-sm text-center">{message}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignup ? "Sign Up" : "Sign In"}
          </button>
        </form>
        <button onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
};

export default Auth;






