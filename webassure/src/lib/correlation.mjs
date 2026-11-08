const REVIEW = new Set(['Suspicious', 'High Risk', 'Confirmed Malicious'])
const hostname = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase().replace(/\.$/, '') : null
  } catch { return null }
}

// Exact, observed relationships only. Shared indicators never change a verdict
// or establish that reports belong to a malicious campaign.
export function correlateReports(reports) {
  const index = new Map()
  const unique = new Map(reports.filter((report) => report?.id).map((report) => [report.id, report]))
  for (const report of unique.values()) {
    const target = hostname(report.normalized_url)
    const add = (kind, value, role) => {
      if (!value) return
      const key = `${kind}:${value}`
      if (!index.has(key)) index.set(key, { id: key, kind, value, matches: new Map() })
      const group = index.get(key)
      if (!group.matches.has(report.id)) group.matches.set(report.id, {
        id: report.id, target: target || 'Unknown host', classification: report.risk_classification || 'Inconclusive',
        createdAt: report.created_at, roles: new Set(), requiresReview: REVIEW.has(report.risk_classification),
      })
      group.matches.get(report.id).roles.add(role)
    }
    add('domain', target, 'Submitted host')
    for (const [position, hop] of (report.redirect_chain || []).entries()) {
      const host = hostname(hop.url)
      add('domain', host, position > 0 ? 'Observed redirect destination' : 'HTTP response host')
      const cert = hop.tls?.certificate
      const fingerprint = typeof cert?.sha256_fingerprint === 'string' ? cert.sha256_fingerprint.replaceAll(':', '').toLowerCase() : ''
      if (hop.tls?.verified === true && cert?.status === 'completed' && /^[0-9a-f]{64}$/.test(fingerprint)) {
        add('certificate', fingerprint, 'Verified TLS leaf fingerprint')
      }
    }
  }
  const groups = [...index.values()].filter((group) => group.matches.size >= 2).map((group) => {
    const matches = [...group.matches.values()].map((match) => ({ ...match, roles: [...match.roles].sort() }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id))
    const redirected = matches.filter((match) => match.roles.includes('Observed redirect destination')).length
    return { id: group.id, kind: group.kind, value: group.value, matches,
      label: group.kind === 'certificate' ? 'Shared certificate' : redirected >= 2 ? 'Shared redirect destination' : 'Repeated domain',
      requiresReview: matches.some((match) => match.requiresReview),
      distinctTargets: new Set(matches.map((match) => match.target)).size,
    }
  }).sort((a, b) => Number(b.requiresReview) - Number(a.requiresReview) || b.matches.length - a.matches.length || a.id.localeCompare(b.id))
  return { groups, linkedReports: new Set(groups.flatMap((group) => group.matches.map((match) => match.id))).size,
    reviewGroups: groups.filter((group) => group.requiresReview).length, reportsAnalysed: unique.size }
}
