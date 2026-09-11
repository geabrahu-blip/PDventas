export const getLocalDateString = (date?: Date): string => {
  const now = date || new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayDateString = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
};

export const getThisWeekRange = (): { start: string, end: string } => {
  const now = new Date();
  const currentDay = now.getDay();
  // Calculate distance to Monday (if Sunday (0), distance is 6, else currentDay - 1)
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - distanceToMonday);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // Sunday

  return {
    start: getLocalDateString(startDate),
    end: getLocalDateString(endDate)
  };
};

export const getThisMonthRange = (): { start: string, end: string } => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month

  return {
    start: getLocalDateString(startDate),
    end: getLocalDateString(endDate)
  };
};
