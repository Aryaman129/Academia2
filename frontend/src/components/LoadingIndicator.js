import React, { useState, useEffect } from "react"

const LoadingIndicator = ({ message }) => {
  const [currentMessage, setCurrentMessage] = useState(message || "Loading...");
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Set up the loading message sequence
    const messages = [
      "Checking your credentials...",
      "Login successful!",
      "Gathering your data...",
      "Almost there, please hold on..."
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
        setCurrentMessage(message || "Loading your data...");
      }
    }, 2000);
    
    return () => {
      clearInterval(dotInterval);
      clearInterval(messageInterval);
    };
  }, [message]);

  return (
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mb-4 mx-auto"></div>
        <p className="text-lg font-semibold text-center">{currentMessage}{dots}</p>
      </div>
    </div>
  )
}

export default LoadingIndicator

