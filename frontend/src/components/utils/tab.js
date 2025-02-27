import React from "react";

import { useState } from "react";

export function Tabs({ defaultValue, children }) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <div>
      {children.map((child) =>
        child.props.value === activeTab
          ? child
          : null
      )}
    </div>
  );
}

export function TabsList({ children }) {
  return <div className="flex space-x-2 border-b pb-2">{children}</div>;
}

export function TabsTrigger({ value, label, setActiveTab, activeTab }) {
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 ${activeTab === value ? "font-bold border-b-2 border-blue-500" : ""}`}
    >
      {label}
    </button>
  );
}

export function TabsContent({ value, children }) {
  return <div>{children}</div>;
}
