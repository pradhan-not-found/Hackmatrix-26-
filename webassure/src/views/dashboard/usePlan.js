'use client'

import { useEffect, useState } from 'react'
import { getPlan } from '../../lib/plan.js'

// Current plan for the signed-in user; updates live after an upgrade.
export function usePlan(userId) {
  const [plan, setPlan] = useState({ id: 'personal', cycle: 'monthly' })
  useEffect(() => {
    setPlan(getPlan(userId))
    const onChange = (e) => setPlan(e.detail)
    window.addEventListener('wa-plan-change', onChange)
    return () => window.removeEventListener('wa-plan-change', onChange)
  }, [userId])
  return plan
}
