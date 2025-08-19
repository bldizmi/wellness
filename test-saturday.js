// Quick test to verify Saturday date calculation
const today = new Date();
console.log('Today is:', today.toDateString());
console.log('Day of week:', today.getDay()); // 0=Sunday, 6=Saturday

const currentDay = today.getDay();
const daysUntilSaturday = currentDay === 6 ? 7 : (6 - currentDay);
const saturday = new Date(today);
saturday.setDate(today.getDate() + daysUntilSaturday);

console.log('Next Saturday will be:', saturday.toDateString());
console.log('Saturday ISO date:', saturday.toISOString().slice(0, 10));