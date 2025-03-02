"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const SUPABASE_URL = "https://zqzitiypvwexenxbkazf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxeml0aXlwdndleGVueGJrYXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMDg0NTIsImV4cCI6MjA1NTg4NDQ1Mn0.Vi_83ZUnK6NebdS1EX1xmH19rthwPAr5FMsqgnIQB30";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Dashboard = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        // ✅ Corrected Session Retrieval
        const { data } = await supabase.auth.getSession();
        console.log("📌 Supabase Session Data:", data); // Debugging

        if (!data.session) {
          throw new Error("Authentication required. Please login again.");
        }

        // ✅ Corrected Token Retrieval
        const token = data.session.access_token;
        if (!token) {
          throw new Error("Invalid session token.");
        }
        console.log("📌 Using Token:", token); // Debugging

        // ✅ Fetch Attendance Data from Backend
        const response = await axios.get("http://localhost:5000/api/attendance", {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });

        console.log("📌 Attendance API Response:", response.data); // Debugging

        if (response.data.success) {
          setAttendanceData(response.data.attendance);
        } else {
          throw new Error(response.data.error || "No attendance records found.");
        }
      } catch (err) {
        console.error("Attendance fetch error:", err);
        setError(err.message || "An error occurred while fetching attendance data.");
        if (err.response?.status === 401) {
          await supabase.auth.signOut();
          navigate("/");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Attendance Records</h1>
      <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md mb-4">
        Logout
      </button>
      {attendanceData.length > 0 ? (
        <ul className="bg-white shadow-md rounded-lg p-4">
          {attendanceData.map((record, index) => (
            <li key={index} className="border-b py-2">
              <span className="font-semibold">{record.course_code}:</span> {record.attendance_percentage}%
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-red-500 font-bold">No attendance records found.</p>
      )}
    </div>
  );
};

export default Dashboard;
