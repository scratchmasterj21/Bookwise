
import type { TimePeriod, DeviceType } from '@/types';

export const TIME_PERIODS: TimePeriod[] = [
  { name: '1st Period', label: '09:00 - 09:45', start: '09:00', end: '09:45' },
  { name: '2nd Period', label: '09:50 - 10:35', start: '09:50', end: '10:35' },
  { name: '3rd Period', label: '10:55 - 11:40', start: '10:55', end: '11:40' },
  { name: '4th Period (LG)', label: '11:45 - 12:30', start: '11:45', end: '12:30' },
  { name: '4th Period (UG)', label: '12:35 - 13:20', start: '12:35', end: '13:20' },
  { name: '5th Period', label: '13:25 - 14:10', start: '13:25', end: '14:10' },
  { name: '6th Period', label: '14:15 - 15:00', start: '14:15', end: '15:00' },
];

export const DEVICE_TYPES_WITH_ICONS: Record<DeviceType | 'Other', string> = {
  Laptop: 'Laptop',
  Tablet: 'Tablet',
  Monitor: 'Monitor',
  Projector: 'Tv', // Using Tv for Projector from lucide
  Other: 'Package',
};

export const DEVICE_PURPOSE_OPTIONS: string[] = [
  "Boom Cards", "Canva",
  "Clubs", "Computer Class",
  "G1 i-Ready Test", "G2 i-Ready Test",
  "G3 i-Ready Test", "G4 i-Ready Test",
  "G5 i-Ready Test", "G6 i-Ready Test",
  "I-ready", "Kahoot",
  "Kids A-Z", "Others",
  "Reach Post Test", "Reach Pre Test",
  "Research", "Youtube"
];
