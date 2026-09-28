import {
  ShoppingBasket, Zap, Bus, PartyPopper, HeartPulse, House, Shirt, CircleEllipsis, Tag,
} from 'lucide-react'

// Icon names stored in the `categories.icon` column -> Lucide components.
const ICONS = {
  'shopping-basket': ShoppingBasket,
  zap: Zap,
  bus: Bus,
  'party-popper': PartyPopper,
  'heart-pulse': HeartPulse,
  home: House,
  shirt: Shirt,
  'circle-ellipsis': CircleEllipsis,
  tag: Tag,
}

export const iconFor = (name) => ICONS[name] ?? Tag

// Stage 2 local ids -> default category names (used when importing data saved on this device).
export const LEGACY_DEFAULT_NAMES = {
  comida: 'Comida',
  servicios: 'Servicios',
  transporte: 'Transporte',
  salidas: 'Salidas',
  salud: 'Salud',
  hogar: 'Hogar',
  ropa: 'Ropa',
  otros: 'Otros',
}
