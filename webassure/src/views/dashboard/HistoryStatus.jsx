'use client'
import { useDash } from './context.js'

const Refresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11.5A8 8 0 1 0 17.7 17" />
    <path d="M20 5v6.5h-6.5" />
  </svg>
)

export default function HistoryStatus() {
  const { scans, total, historyLoading, historyError, refreshHistory, loadMore } = useDash()
  const label = historyError ? 'Retry loading history' : 'Refresh history'
  return <div className="history-status">
    <p className="caption grey" role="status">{historyLoading ? 'Loading saved investigations…' : `${scans.length} of ${total} saved investigations loaded`}</p>
    {historyError && <p role="alert">{historyError}</p>}
    <button className="icon-btn hs__refresh" data-spin={historyLoading || undefined} disabled={historyLoading} onClick={() => refreshHistory()} aria-label={label} title={label}>
      <Refresh />
    </button>
    {scans.length < total && <button className="btn btn--ghost" disabled={historyLoading} onClick={loadMore}>Load more</button>}
  </div>
}
