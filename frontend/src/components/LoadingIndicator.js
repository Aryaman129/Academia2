import React from "react"
const LoadingIndicator = ({ message }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-white">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mb-4"></div>
        <p className="text-lg font-semibold">{message || "Loading..."}</p>
      </div>
    </div>
  )
}

export default LoadingIndicator

