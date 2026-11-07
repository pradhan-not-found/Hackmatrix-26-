'use client'
import { useDash } from './context.js'

export default function HistoryStatus() {
  const { scans, total, historyLoading, historyError, refreshHistory, loadMore } = useDash()
  return <div className="history-status">
    <p className="caption grey" role="status">{historyLoading ? 'Loading saved investigations…' : `${scans.length} of ${total} saved investigations loaded`}</p>
    {historyError && <p role="alert">{historyError}</p>}
    <button className="btn btn--ghost" disabled={historyLoading} onClick={() => refreshHistory()}>{historyError ? 'Retry history' : 'Refresh history'}</button>
    {scans.length < total && <button className="btn btn--ghost" disabled={historyLoading} onClick={loadMore}>Load more</button>}
  </div>
}
