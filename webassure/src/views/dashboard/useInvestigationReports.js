'use client'

import { useEffect, useState } from 'react'
import { useDash } from './context.js'

export function useInvestigationReports() {
  const { scans, getReport } = useDash()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setReports([])
    const collect = async () => {
      const results = []
      let failed = 0
      for (let offset = 0; offset < scans.length; offset += 4) {
        const batch = await Promise.allSettled(scans.slice(offset, offset + 4).map((scan) => getReport(scan.id)))
        if (!active) return
        for (const result of batch) result.status === 'fulfilled' ? results.push(result.value) : failed++
      }
      if (active) {
        setReports(results); setLoading(false)
        if (failed) setError(`${failed} report(s) could not be loaded. Connections and counts may be incomplete.`)
      }
    }
    collect()
    return () => { active = false }
  }, [scans, getReport, attempt])
  return { reports, loading, error, retry: () => setAttempt((value) => value + 1) }
}
