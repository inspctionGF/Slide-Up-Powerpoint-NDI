import {
  ArrowLeft,
  Blend,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  EyeOff,
  FolderOpen,
  History,
  Keyboard,
  Layers,
  type LucideProps,
  Minus,
  PanelBottom,
  PanelLeft,
  Pause,
  Pencil,
  PictureInPicture2,
  Pin,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  Snowflake,
  Square,
  X
} from 'lucide-react'

type IconProps = {
  className?: string
}

const base: LucideProps = {
  absoluteStrokeWidth: false,
  strokeWidth: 1.75,
  'aria-hidden': true
}

export function IconFolder({ className }: IconProps): JSX.Element {
  return <FolderOpen className={className} {...base} />
}

export function IconPlay({ className }: IconProps): JSX.Element {
  return <Play className={className} {...base} fill="currentColor" strokeWidth={0} />
}

export function IconLayers({ className }: IconProps): JSX.Element {
  return <Layers className={className} {...base} />
}

export function IconChevronLeft({ className }: IconProps): JSX.Element {
  return <ChevronLeft className={className} {...base} strokeWidth={2} />
}

export function IconChevronRight({ className }: IconProps): JSX.Element {
  return <ChevronRight className={className} {...base} strokeWidth={2} />
}

export function IconBroadcast({ className }: IconProps): JSX.Element {
  return <Radio className={className} {...base} />
}

export function IconPin({ className }: IconProps): JSX.Element {
  return <Pin className={className} {...base} />
}

export function IconTransparency({ className }: IconProps): JSX.Element {
  return <Blend className={className} {...base} />
}

export function IconArrowLeft({ className }: IconProps): JSX.Element {
  return <ArrowLeft className={className} {...base} />
}

export function IconLayoutLeft({ className }: IconProps): JSX.Element {
  return <PanelLeft className={className} {...base} />
}

export function IconLayoutBottom({ className }: IconProps): JSX.Element {
  return <PanelBottom className={className} {...base} />
}

export function IconPip({ className }: IconProps): JSX.Element {
  return <PictureInPicture2 className={className} {...base} />
}

export function IconClose({ className }: IconProps): JSX.Element {
  return <X className={className} {...base} strokeWidth={2} />
}

export function IconHistory({ className }: IconProps): JSX.Element {
  return <History className={className} {...base} />
}

export function IconRefresh({ className }: IconProps): JSX.Element {
  return <RefreshCw className={className} {...base} />
}

export function IconWinMinimize({ className }: IconProps): JSX.Element {
  return <Minus className={className} {...base} strokeWidth={2} />
}

export function IconWinMaximize({ className }: IconProps): JSX.Element {
  return <Square className={className} {...base} strokeWidth={1.8} />
}

export function IconWinRestore({ className }: IconProps): JSX.Element {
  return <Copy className={className} {...base} strokeWidth={1.8} />
}

export function IconWinClose({ className }: IconProps): JSX.Element {
  return <X className={className} {...base} strokeWidth={2} />
}

export function IconEdit({ className }: IconProps): JSX.Element {
  return <Pencil className={className} {...base} />
}

export function IconSettings({ className }: IconProps): JSX.Element {
  return <Settings className={className} {...base} />
}

export function IconKeyboard({ className }: IconProps): JSX.Element {
  return <Keyboard className={className} {...base} />
}

export function IconClock({ className }: IconProps): JSX.Element {
  return <Clock className={className} {...base} />
}

export function IconCalendar({ className }: IconProps): JSX.Element {
  return <CalendarDays className={className} {...base} />
}

export function IconPause({ className }: IconProps): JSX.Element {
  return <Pause className={className} {...base} />
}

export function IconReset({ className }: IconProps): JSX.Element {
  return <RotateCcw className={className} {...base} />
}

export function IconBlackout({ className }: IconProps): JSX.Element {
  return <EyeOff className={className} {...base} />
}

export function IconFreeze({ className }: IconProps): JSX.Element {
  return <Snowflake className={className} {...base} />
}
