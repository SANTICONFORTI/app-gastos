import {
  ShoppingBasket, Zap, Bus, PartyPopper, HeartPulse, Sofa, Shirt, Tag,
} from 'lucide-react'

export const CATEGORIES = [
  { id: 'comida', name: 'Comida', color: '#5AC8FA', Icon: ShoppingBasket },
  { id: 'servicios', name: 'Servicios', color: '#FFB547', Icon: Zap },
  { id: 'transporte', name: 'Transporte', color: '#8B93FF', Icon: Bus },
  { id: 'salidas', name: 'Salidas', color: '#FF7A96', Icon: PartyPopper },
  { id: 'salud', name: 'Salud', color: '#4ADE80', Icon: HeartPulse },
  { id: 'hogar', name: 'Hogar', color: '#F59E0B', Icon: Sofa },
  { id: 'ropa', name: 'Ropa', color: '#E879F9', Icon: Shirt },
  { id: 'otros', name: 'Otros', color: '#8C9BBB', Icon: Tag },
]

export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
