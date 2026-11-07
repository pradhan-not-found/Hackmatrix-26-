'use client'
import { useDash } from './context.js'

const Refresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v5h-5" />
  </svg>
)

export default function HistoryStatus() {
  const { scans, total, historyLoading, historyError, refreshHistory, loadMore } = useDash()
  const label = historyError ? 'Retry loading history' : 'Refresh history'
  return <div className="history-status">
    <p className="caption grey" role="status">{historyLoading ? 'Loading saved investigations…' : `${scans.length} of ${total} saved investigations loaded`}</p>
    {historyError && <p role="alert">{historyError}</p>}
    <button className="hs__refresh" data-spin={historyLoading || undefined} disabled={historyLoading} onClick={() => refreshHistory()} aria-label={label} title={label}>
      <Refresh />
    </button>
    {scans.length < total && <button className="btn btn--ghost" disabled={historyLoading} onClick={loadMore}>Load more</button>}
  </div>
}
