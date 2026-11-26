import { seedText } from '../i18n/ar';
export const ROUNDING_THRESHOLDS = { half: 35, quarter: 45 } as const;
export const permissions = [
  'startSession',
  'endSession',
  'cancelSession',
  'voidSession',
  'editSessionTime',
  'applyDiscount',
  'manageExpenses',
  'openCloseShift',
  'viewReports',
  'exportReports',
  'editSettings',
  'manageBackup',
] as const;
export type Permission = (typeof permissions)[number];
export interface User {
  authProvider?: 'firebase';
  id: string;
  username: string;
  admin: boolean;
  active: boolean;
  permissions: Permission[];
  password: string;
  recovery?: string;
}
export interface RoomType {
  id: string;
  name: string;
  single: number;
  double: number;
  count: number;
}
export interface Room {
  id: string;
  typeId: string;
  name: string;
  active: boolean;
}
export interface Service {
  id: string;
  name: string;
  price: number;
  active: boolean;
}
export interface Settings {
  shopName: string;
  device: string;
  currency: string;
  logo: string;
  timezone: string;
  roundTime: boolean;
  priceRound: 'pound' | 'half' | 'none';
  thresholds: { half: number; quarter: number };
  idleMinutes: number;
  indic: boolean;
  types: RoomType[];
  services: Service[];
  categories: string[];
  persistent: boolean;
  lastReminder: string;
}
export interface ServiceLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
}
export interface Discount {
  kind: 'fixed' | 'percent';
  value: number;
  reason: string;
}
export interface Bill {
  minutes: number;
  billedMinutes: number;
  play: number;
  services: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  unpaid: number;
}
export interface Session {
  id: string;
  shiftId: string;
  roomId: string;
  roomName: string;
  mode: 'single' | 'double';
  rate: number;
  start: number;
  end?: number;
  timezone: string;
  note: string;
  status: 'running' | 'finished' | 'cancelled' | 'voided';
  services: ServiceLine[];
  discount?: Discount;
  bill?: Bill;
  createdBy: string;
  endedBy?: string;
  reason?: string;
  pricing: Pick<Settings, 'roundTime' | 'priceRound' | 'thresholds'>;
}
export interface Totals {
  play: number;
  services: number;
  discounts: number;
  expenses: number;
  net: number;
  unpaid: number;
  count: number;
  cancelled: number;
  voided: number;
}
export interface Shift {
  id: string;
  date: string;
  start: number;
  end?: number;
  openedBy: string;
  closedBy?: string;
  note: string;
  frozen?: Report;
}
export interface Expense {
  id: string;
  shiftId: string;
  description: string;
  amount: number;
  category: string;
  voided: boolean;
  createdBy: string;
}
export interface Audit {
  id: string;
  at: number;
  userId: string;
  action: string;
  detail: string;
}
export interface State {
  schemaVersion: number;
  appVersion: string;
  settings: Settings;
  users: User[];
  rooms: Room[];
  sessions: Session[];
  shifts: Shift[];
  expenses: Expense[];
  audit: Audit[];
}
export interface Report {
  rooms: Room[];
  title: string;
  period: string;
  generatedAt: number;
  settings: Settings;
  shifts: Shift[];
  sessions: Session[];
  expenses: Expense[];
  totals: Totals;
  users: Pick<User, 'id' | 'username'>[];
}
export function defaults(): State {
  return {
    schemaVersion: 2,
    appVersion: '2.0.0',
    settings: {
      shopName: seedText.shop,
      device: seedText.device,
      currency: seedText.currency,
      logo: '',
      timezone: 'Africa/Cairo',
      roundTime: true,
      priceRound: 'pound',
      thresholds: { ...ROUNDING_THRESHOLDS },
      idleMinutes: 0,
      indic: false,
      types: [
        { id: 'ps4', name: 'PS4', single: 2500, double: 5000, count: 2 },
        { id: 'ps5', name: 'PS5', single: 6000, double: 8000, count: 2 },
      ],
      services: [
        { id: 'tea', name: seedText.tea, price: 1000, active: true },
        { id: 'coffee', name: seedText.coffee, price: 1500, active: true },
      ],
      categories: [...seedText.categories],
      persistent: false,
      lastReminder: '',
    },
    users: [],
    rooms: [],
    sessions: [],
    shifts: [],
    expenses: [],
    audit: [],
  };
}
