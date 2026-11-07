import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Files,
  Globe,
  Home,
  KeyRound,
  Image,
  Library,
  Link,
  Monitor,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Quote,
  RotateCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Trash2,
  Ungroup,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IconName =
  | "back"
  | "forward"
  | "reload"
  | "close"
  | "plus"
  | "pin"
  | "unpin"
  | "key"
  | "export"
  | "search"
  | "more"
  | "settings"
  | "arrow-up-right"
  | "trash"
  | "chevron-down"
  | "chevron-up"
  | "check"
  | "clock"
  | "tab"
  | "sheets"
  | "bookmark"
  | "home"
  | "globe"
  | "ungroup"
  | "smartphone"
  | "tablet"
  | "monitor"
  | "library"
  | "copy"
  | "quote"
  | "image"
  | "video"
  | "link";

/** One set, one weight. The names are ours; the drawings are Lucide's. */
const ICONS: Record<IconName, LucideIcon> = {
  back: ArrowLeft,
  forward: ArrowRight,
  reload: RotateCw,
  close: X,
  plus: Plus,
  pin: Pin,
  unpin: PinOff,
  key: KeyRound,
  export: Download,
  search: Search,
  more: MoreHorizontal,
  settings: SlidersHorizontal,
  "arrow-up-right": ArrowUpRight,
  trash: Trash2,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  check: Check,
  clock: Clock,
  tab: AppWindow,
  sheets: Files,
  bookmark: Bookmark,
  home: Home,
  globe: Globe,
  ungroup: Ungroup,
  smartphone: Smartphone,
  tablet: Tablet,
  monitor: Monitor,
  library: Library,
  copy: Copy,
  quote: Quote,
  image: Image,
  video: Video,
  link: Link,
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.5,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      className="icon"
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    />
  );
}
