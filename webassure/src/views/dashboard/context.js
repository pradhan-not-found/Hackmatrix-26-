'use client'

import { createContext, useContext } from 'react'

export const DashContext = createContext(null)

export function useDash() {
  return useContext(DashContext)
}
