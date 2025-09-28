// Fix time calculation
const now = new Date();
const timeDiff = now.getTime() - new Date("2025-09-28T05:55:01Z").getTime();
console.log("Time difference in minutes:", Math.floor(timeDiff / (1000 * 60)));
