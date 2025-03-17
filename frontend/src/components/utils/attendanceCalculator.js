import React from "react";
export const calculateAttendance = (totalClasses, attendedClasses) => {
  if (totalClasses <= 0 || attendedClasses < 0) {
    return {
      error: "Invalid input values.",
      currentPercentage: 0,
      classesNeeded: 0,
      canSkip: 0,
      isAbove75: false,
    }
  }

  const currentPercentage = (attendedClasses / totalClasses) * 100

  let classesNeeded = 0
  let tempTotal = totalClasses

  // Iteratively find the required classes to reach 75%
  while ((attendedClasses / tempTotal) * 100 < 75) {
    tempTotal++
    classesNeeded++
  }

  // Calculate how many can be skipped while staying above 75%
  const maxPossibleSkips = Math.floor(attendedClasses - 0.75 * totalClasses)

  return {
    currentPercentage: currentPercentage.toFixed(2),
    classesNeeded,
    canSkip: maxPossibleSkips > 0 ? maxPossibleSkips : 0,
    isAbove75: currentPercentage >= 75,
  }
}

