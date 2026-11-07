'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggle: () => {} })

// Runs before paint (inlined in <head>) so the saved theme never flashes.
export const themeScript = `try{var t=localStorage.getItem('wa-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || 'light')
  }, [])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('wa-theme', next)
      } catch {}
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
