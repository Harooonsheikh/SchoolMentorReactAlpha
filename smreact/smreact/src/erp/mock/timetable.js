export const mockTimeTableClasses = [
  { id: 1,  name: 'Class 1A', section: 'B' },
  { id: 2,  name: 'Class 1A', section: 'C' },
  { id: 3,  name: 'Class 1A', section: 'D' },
  { id: 4,  name: 'II-Pre',   section: 'A' },
  { id: 5,  name: 'III-Pre',  section: '2' },
  { id: 6,  name: 'IV',       section: 'A' },
  { id: 7,  name: 'V',        section: 'A' },
  { id: 8,  name: 'VI',       section: 'A' },
  { id: 9,  name: 'VII',      section: 'A' },
  { id: 10, name: 'VIII',     section: 'A' },
  { id: 11, name: 'IX',       section: 'A' },
];

const SAMPLE_PERIODS = [
  { startTime: '08:00', endTime: '08:40', subject: 'English',     teacher: 'Ms. Ayesha Raza' },
  { startTime: '08:40', endTime: '09:20', subject: 'Mathematics', teacher: 'Mr. Bilal Ahmed' },
  { startTime: '09:20', endTime: '09:40', subject: 'Break',       teacher: '' },
  { startTime: '09:40', endTime: '10:20', subject: 'Urdu',        teacher: 'Ms. Fatima Khan' },
  { startTime: '10:20', endTime: '11:00', subject: 'Science',     teacher: 'Mr. Hassan Ali' },
];

/* Six days (Mon..Sat). Every other (day, class) gets the sample schedule. */
export const mockTimeTable = (() => {
  const data = {};
  for (let di = 0; di < 6; di++) {
    data[di] = {};
    mockTimeTableClasses.forEach((cls, ci) => {
      const key = `${cls.id}_${cls.section}`;
      if ((ci + di) % 2 === 0) data[di][key] = SAMPLE_PERIODS.map(p => ({ ...p }));
    });
  }
  return data;
})();
