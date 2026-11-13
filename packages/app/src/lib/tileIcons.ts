import {
  ArrowLeftRight,
  Bell,
  Car,
  CheckCheck,
  CreditCard,
  Home,
  Megaphone,
  MessageCircle,
  Package,
  Repeat,
  ScanLine,
  ShieldAlert,
  Siren,
  UserCircle,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Bell,
  Car,
  CheckCheck,
  CreditCard,
  Home,
  Megaphone,
  MessageCircle,
  Package,
  Repeat,
  ScanLine,
  ShieldAlert,
  Siren,
  UserCircle,
  UserPlus,
  Users,
};

export function tileIcon(name: string): LucideIcon {
  return ICONS[name] ?? Bell;
}
