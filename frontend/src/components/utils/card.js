import React from "react";
export function Card({ children }) {
    return <div className="border p-4 rounded-md shadow-md">{children}</div>;
  }
  
  export function CardHeader({ children }) {
    return <div className="font-bold text-lg mb-2">{children}</div>;
  }
  
  export function CardContent({ children }) {
    return <div>{children}</div>;
  }
  
  export function CardTitle({ children }) {
    return <h3 className="text-xl font-semibold">{children}</h3>;
  }
  
  export function CardDescription({ children }) {
    return <p className="text-gray-500">{children}</p>;
  }
  