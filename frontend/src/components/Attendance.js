import React, { useEffect, useState } from "react";
import axios from "axios";

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const registrationNumber = localStorage.getItem("registration_number");
        const response = await axios.get(`http://localhost:5000/api/attendance?user_id=${registrationNumber}`);
        setAttendance(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Error fetching attendance");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Attendance Records</h2>
      {attendance.length > 0 ? (
        <ul>
          {attendance.map((record, index) => (
            <li key={index}>
              {record.course_title} - {record.attendance_percentage}%
            </li>
          ))}
        </ul>
      ) : (
        <p>No attendance records found.</p>
      )}
    </div>
  );
};

export default Attendance;
