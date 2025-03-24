import React, { useState, useEffect } from "react"

const LoadingIndicator = ({ message }) => {
  const [currentMessage, setCurrentMessage] = useState(message || "Loading...");
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Set up the loading message sequence
    const messages = [
      "Checking your credentials...",
      "Login successful!",
      "Almost there, please hold on...",
      "Processing your data...",
      "Preparing your dashboard..."
    ];
    
    let messageIndex = 0;
    let dotCount = 0;
    
    // Update dots animation
    const dotInterval = setInterval(() => {
      setDots(".".repeat(dotCount % 4));
      dotCount++;
    }, 500);
    
    // Change messages every few seconds
    const messageInterval = setInterval(() => {
      if (messageIndex < messages.length) {
        setCurrentMessage(messages[messageIndex]);
        messageIndex++;
      } else {
        // Loop back to start if we've gone through all messages
        messageIndex = 3; // Start from "Fetching your timetable..." again
      }
    }, 3000);
    
    return () => {
      clearInterval(dotInterval);
      clearInterval(messageInterval);
    };
  }, [message]);

  return (
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white max-w-md">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mb-4 mx-auto"></div>
        <p className="text-lg font-semibold text-center">{currentMessage}{dots}</p>
        <p className="text-xs text-gray-400 text-center mt-4">This might take a minute, please be patient.</p>
      </div>
    </div>
  )
}

export default LoadingIndicator

