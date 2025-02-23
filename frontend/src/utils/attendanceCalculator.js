export const calculateAttendance = (totalClasses, attendedClasses) => {
    const currentPercentage = (attendedClasses / totalClasses) * 100;
    
    // Calculate classes needed to reach 75%
    const classesFor75 = Math.ceil((0.75 * totalClasses - attendedClasses) / 0.25);
    
    // Calculate how many can be skipped while staying above 75%
    const canSkip = Math.floor(attendedClasses - (0.75 * totalClasses));
  
    return {
      currentPercentage: currentPercentage.toFixed(2),
      classesNeeded: classesFor75 > 0 ? classesFor75 : 0,
      canSkip: canSkip > 0 ? canSkip : 0,
      isAbove75: currentPercentage >= 75
    };
  };