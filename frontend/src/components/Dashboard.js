import React, { useEffect, useState } from "react";
import axios from "axios";
import { calculateAttendance } from "../utils/attendanceCalculator";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    attendance: {},
    timetable: {},
    marks: {}
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        
        // Fetch all required data
        const [attendanceRes, timetableRes, marksRes] = await Promise.all([
          axios.get("http://localhost:5000/AttAndMarks", {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get("http://localhost:5000/TimeTable", {
            headers: { Authorization: `Bearer ${token}` },
            params: { batch: "1" } // Assuming batch 1, adjust as needed
          }),
          axios.get("http://localhost:5000/PersonalDetails", {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setData({
          attendance: attendanceRes.data.data,
          timetable: timetableRes.data.data,
          marks: marksRes.data.data
        });
      } catch (err) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <h3>Attendance</h3>
      {data.attendance.map((subject, index) => {
        const attendance = calculateAttendance(subject.HoursConducted, subject.HoursConducted - subject.HoursAbsent);
        return (
          <div key={index}>
            <h4>{subject.CourseTitle}</h4>
            <p>Current: {attendance.currentPercentage}%</p>
            {!attendance.isAbove75 && (
              <p>Need to attend next {attendance.classesNeeded} classes</p>
            )}
            {attendance.isAbove75 && (
              <p>Can skip {attendance.canSkip} classes</p>
            )}
          </div>
        );
      })}
      <h3>Timetable</h3>
      <pre>{JSON.stringify(data.timetable, null, 2)}</pre>
      <h3>Marks</h3>
      <pre>{JSON.stringify(data.marks, null, 2)}</pre>
    </div>
  );
};

export default Dashboard;