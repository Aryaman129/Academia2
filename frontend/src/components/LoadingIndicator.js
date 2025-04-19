import React, { useState, useEffect } from "react"

const LoadingIndicator = ({ message }) => {
  const [currentMessage, setCurrentMessage] = useState(message || "Loading...");
  const [dots, setDots] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Reset elapsed time when message changes
    setElapsedTime(0);
  }, [message]);

  useEffect(() => {
    // If a custom message is provided, use it instead of the sequence
    if (message) {
      setCurrentMessage(message);
    } else {
      // Set up the loading message sequence
      const messages = [
        "Checking your credentials...",
        "Login successful!",
        "Almost there, please hold on...",
        "Processing your data...",
        "Preparing your dashboard...",
        "It might take some time if you're a new user..."
      ];

      let messageIndex = 0;

      // Change messages every few seconds
      const messageInterval = setInterval(() => {
        if (messageIndex < messages.length) {
          setCurrentMessage(messages[messageIndex]);
          messageIndex++;
        } else {
          // Loop back to start if we've gone through all messages
          messageIndex = 3; // Start from "Processing your data..." again
        }
      }, 3000);

      return () => {
        clearInterval(messageInterval);
      };
    }
  }, [message]);

  // Dots animation and elapsed time counter
  useEffect(() => {
    let dotCount = 0;
    let seconds = 0;

    // Update dots animation
    const dotInterval = setInterval(() => {
      setDots(".".repeat(dotCount % 4));
      dotCount++;
    }, 500);

    // Update elapsed time counter
    const timeInterval = setInterval(() => {
      seconds++;
      setElapsedTime(seconds);
    }, 1000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // Format elapsed time
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Show a different message if it's taking too long
  const getWaitMessage = () => {
    if (elapsedTime < 30) {
      return "This might take a minute, please be patient.";
    } else if (elapsedTime < 60) {
      return "This is taking longer than expected. Please continue to wait...";
    } else if (elapsedTime < 120) {
      return "The server is busy. Please continue to wait or try again later.";
    } else {
      return "This is taking unusually long. You may want to refresh the page and try again.";
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white max-w-md">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mb-4 mx-auto"></div>
        <p className="text-lg font-semibold text-center">{currentMessage}{dots}</p>
        <p className="text-xs text-gray-400 text-center mt-4">{getWaitMessage()}</p>
        <p className="text-xs text-gray-500 text-center mt-2">Elapsed time: {formatTime(elapsedTime)}</p>
      </div>
    </div>
  )
}

export default LoadingIndicator

