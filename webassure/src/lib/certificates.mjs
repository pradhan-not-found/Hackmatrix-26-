export function certificateRows(reports, now = Date.now()) {
  const latest = new Map()
  for (const report of [...reports].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    const observations = new Map()
    for (const hop of report.redirect_chain || []) {
      try {
        const url = new URL(hop.url)
        if (url.protocol === 'https:') observations.set(url.hostname, { host: url.hostname, tls: hop.tls })
      } catch {}
    }
    for (const check of report.checks || []) {
      if (check.name !== 'tls' || check.status !== 'failed' || !check.url) continue
      try { observations.set(new URL(check.url).hostname, { host: new URL(check.url).hostname, error: check.error || 'TLS verification failed.' }) } catch {}
    }
    try {
      const url = new URL(report.normalized_url)
      if (url.protocol === 'https:' && !observations.has(url.hostname)) observations.set(url.hostname, { host: url.hostname })
    } catch {}
    for (const [host, observation] of observations) {
      const tls = observation.tls || {}
      const cert = tls.certificate || {}
      const expiry = Date.parse(cert.not_after || tls.not_after || '')
      const begins = Date.parse(cert.not_before || tls.not_before || '')
      const days = Number.isFinite(expiry) ? Math.ceil((expiry - now) / 86400000) : null
      const weak = cert.public_key?.status === 'weak' || cert.signature?.status === 'weak'
      const complete = cert.public_key?.status === 'acceptable' && cert.signature?.status === 'acceptable'
      const expired = Number.isFinite(expiry) && expiry <= now
      const future = Number.isFinite(begins) && begins > now
      const status = observation.error || expired || future || weak ? 'bad'
        : !tls.verified || days === null || !complete || days <= 14 ? 'warn' : 'ok'
      const label = observation.error ? 'Verification failed' : expired ? 'Expired' : future ? 'Not yet valid' : weak ? 'Weak cryptography'
        : !tls.verified ? 'Not collected' : days !== null && days <= 14 ? 'Expiring soon' : !complete || days === null ? 'Checks incomplete' : 'Verified at scan'
      latest.set(host, { ...observation, tls, cert, days, status, label, reportId: report.id, checkedAt: report.completed_at || report.created_at })
    }
  }
  return [...latest.values()].sort((a, b) => a.host.localeCompare(b.host))
}
