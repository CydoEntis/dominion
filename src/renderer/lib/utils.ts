import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

export function shortPath(p: string): string {
  const parts = normalizePath(p).split('/').filter(Boolean)
  if (parts.length <= 2) return normalizePath(p)
  return `…/${parts.slice(-2).join('/')}`
}
