'use client'

import { useEffect, useRef, useState } from 'react'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { PageHead, Tabs, RiskCell, Empty, Kpi } from './ui.jsx'
import { MailIcon, FileIcon, LinkIcon, ShieldCheckIcon, AlertTriangleIcon, InfoIcon, LoaderIcon, CheckIcon, XIcon, DownloadIcon, GmailIcon } from '../../components/Icons.jsx'

const CLASSIFICATION_TONES = {
  'SAFE': 'ok',
  'SUSPICIOUS': 'warn',
  'SCAM': 'bad',
  'PHISHING': 'bad'
}

const CLASSIFICATION_LABELS = {
  'SAFE': 'Safe',
  'SUSPICIOUS': 'Suspicious',
  'SCAM': 'Scam',
  'PHISHING': 'Phishing'
}

const SEVERITY_TONES = {
  'CRITICAL': 'bad',
  'HIGH': 'bad',
  'MEDIUM': 'warn',
  'LOW': 'ok',
  'INFO': 'ok'
}

const AUTH_STATUS_TONES = {
  'PASS': 'ok',
  'FAIL': 'bad',
  'SOFTFAIL': 'warn',
  'NONE': 'warn',
  'PRESENT': 'ok'
}

async function readApiResponse(response, fallbackMessage) {
  const body = await response.text()
  let data
  try {
    data = body ? JSON.parse(body) : {}
  } catch {
    const htmlResponse = response.headers.get('content-type')?.includes('text/html') || body.trimStart().startsWith('<')
    throw new Error(htmlResponse
      ? `${fallbackMessage}. The email API returned an HTML page; make sure the FastAPI server is running and WEBASSURE_API_URL points to it.`
      : `${fallbackMessage}. The server returned an invalid JSON response.`)
  }
  if (!response.ok) {
    const error = new Error(response.status === 401
      ? 'Gmail session expired. Please reconnect.'
      : data.detail || data.message || fallbackMessage)
    error.status = response.status
    throw error
  }
  return data
}

function classificationTone(classification) {
  return CLASSIFICATION_TONES[classification] || 'ok'
}

function classificationLabel(classification) {
  return CLASSIFICATION_LABELS[classification] || classification
}

function severityTone(severity) {
  return SEVERITY_TONES[severity] || 'ok'
}

function authTone(status) {
  return AUTH_STATUS_TONES[status] || 'ok'
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return isoString
  }
}

function exportReport(report) {
  const data = {
    id: report.id,
    classification: report.classification,
    risk_score: report.risk_score,
    sender: report.sender,
    subject: report.subject,
    analyzed_at: report.analyzed_at,
    indicators: report.indicators,
    authentication: report.authentication,
    urls: report.urls,
    attachments: report.attachments,
    recommendations: report.recommendations
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `email-analysis-${report.id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function IndicatorBadge({ indicator }) {
  return (
    <Badge tone={severityTone(indicator.severity)}>
      {indicator.type.replace(/_/g, ' ')}
    </Badge>
  )
}

function AuthRow({ label, value, details }) {
  return (
    <div className="auth-row">
      <div className="auth-label">
        <span>{label}</span>
        <Badge tone={authTone(value)}>{value}</Badge>
      </div>
      {details && details.length > 0 && (
        <details className="auth-details">
          <summary>Details</summary>
          <pre>{details.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}

function UrlRow({ url }) {
  return (
    <div className="url-row">
      <div className="url-info">
        <a href={url.url} target="_blank" rel="noopener noreferrer" className="url-link">{url.url}</a>
        {url.normalized && url.normalized !== url.url && <span className="url-normalized">→ {url.normalized}</span>}
      </div>
      <div className="url-risk">
        <Badge tone={classificationTone(url.risk_classification)}>{url.risk_classification}</Badge>
        {url.risk_score !== undefined && <span className="url-score">Score: {url.risk_score}</span>}
      </div>
      {url.findings && url.findings.length > 0 && (
        <details className="url-findings">
          <summary>Findings ({url.findings.length})</summary>
          <ul>
            {url.findings.map((f, i) => (
              <li key={i}><Badge tone={severityTone(f.severity)}>{f.category}</Badge> {f.description}</li>
            ))}
          </ul>
        </details>
      )}
      {url.redirect_chain && url.redirect_chain.length > 1 && (
        <details className="url-redirects">
          <summary>Redirect chain ({url.redirect_chain.length})</summary>
          <ul>
            {url.redirect_chain.map((r, i) => (
              <li key={i}><code>{r}</code></li>
            ))}
          </ul>
        </details>
      )}
      {url.error && <p className="url-error">Error: {url.error}</p>}
    </div>
  )
}

function AttachmentRow({ attachment }) {
  return (
    <div className="attachment-row">
      <div className="attachment-info">
        <span className="attachment-name">{attachment.filename}</span>
        <span className="attachment-meta">{attachment.content_type} · {Math.round(attachment.size / 1024)} KB</span>
      </div>
      <Badge tone={severityTone(attachment.risk_level)}>{attachment.risk_level}</Badge>
      {attachment.risk_reasons && attachment.risk_reasons.length > 0 && (
        <ul className="attachment-reasons">
          {attachment.risk_reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <p className="attachment-note">{attachment.scan_note}</p>
    </div>
  )
}

function AiExplanation({ explanation }) {
  if (!explanation) return null
  if (explanation.status !== 'completed') {
    return (
      <div className="ai-explanation unavailable">
        <InfoIcon size={16} />
        <span>AI explanation unavailable: {explanation.reason || explanation.error || 'Unknown error'}</span>
      </div>
    )
  }

  return (
    <div className="ai-explanation">
      <div className="ai-meta">
        <span>{explanation.provider} · {explanation.model}</span>
        <span>{formatDate(explanation.generated_at)}</span>
      </div>
      {explanation.summary && (
        <div className="ai-section">
          <h4>Summary</h4>
          <p>{explanation.summary.text}</p>
        </div>
      )}
      {explanation.explanations && explanation.explanations.length > 0 && (
        <div className="ai-section">
          <h4>What the checks mean</h4>
          {explanation.explanations.map((item, i) => (
            <div key={i} className="ai-item">
              <p>{item.text}</p>
              {item.evidence_ids && <span className="ai-evidence">Evidence: {item.evidence_ids.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
      {explanation.next_steps && explanation.next_steps.length > 0 && (
        <div className="ai-section">
          <h4>Recommended actions</h4>
          <ul>
            {explanation.next_steps.map((item, i) => (
              <li key={i}>{item.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function EmailAnalysis() {
  const { addScan } = useDash()
  const [activeTab, setActiveTab] = useState('input')
  const [inputMethod, setInputMethod] = useState('text')
  const [emailText, setEmailText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailUser, setGmailUser] = useState(null)
  const [gmailMessages, setGmailMessages] = useState([])
  const [selectedGmailMessages, setSelectedGmailMessages] = useState([])
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailAuthLoading, setGmailAuthLoading] = useState(false)
  const [gmailQuery, setGmailQuery] = useState('is:unread')
  const [gmailPageToken, setGmailPageToken] = useState(null)

  useEffect(() => {
    const handleGmailAuthMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'webassure:gmail-auth') return
      if (event.data.status === 'success') {
        setGmailUser(event.data.user)
        setGmailConnected(true)
        setError('')
      } else {
        setError('Gmail authorization failed. Please try connecting again.')
      }
    }
    window.addEventListener('message', handleGmailAuthMessage)
    return () => window.removeEventListener('message', handleGmailAuthMessage)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get('gmail_oauth')
    if (!outcome) return
    if (outcome === 'success') {
      const user = { email: params.get('email') || '', name: '' }
      if (window.opener) {
        window.opener.postMessage({ type: 'webassure:gmail-auth', status: 'success', user }, window.location.origin)
        window.close()
      } else if (user.email) {
        setGmailUser(user)
        setGmailConnected(true)
      }
    } else {
      if (window.opener) {
        window.opener.postMessage({ type: 'webassure:gmail-auth', status: 'error' }, window.location.origin)
        window.close()
      } else setError('Gmail authorization failed. Please try connecting again.')
    }
    window.history.replaceState({}, document.title, '/dashboard/email-analysis')
  }, [])

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!emailText.trim()) return setError('Please enter email content')
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/email/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_content: emailText })
      })
      const data = await readApiResponse(response, 'Email analysis failed')
      setReport(data)
      setActiveTab('results')
      // Also add to scans list for dashboard integration
      addScan({
        id: data.id,
        url: `email:${data.subject || 'Email analysis'}`,
        risk: data.risk_score,
        category: 'Email Analysis',
        when: 'Just now',
        source: 'Email',
        findings: data.indicators.map(i => `${i.type}: ${i.evidence}`),
        fresh: true
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) return setError('Please select an .eml file')
    if (!selectedFile.name.toLowerCase().endsWith('.eml')) return setError('Only .eml files are supported')
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const response = await fetch('/api/email/upload', {
        method: 'POST',
        body: formData
      })
      const data = await readApiResponse(response, 'Email file analysis failed')
      setReport(data)
      setActiveTab('results')
      addScan({
        id: data.id,
        url: `email:${data.subject || 'Email analysis'}`,
        risk: data.risk_score,
        category: 'Email Analysis',
        when: 'Just now',
        source: 'Email',
        findings: data.indicators.map(i => `${i.type}: ${i.evidence}`),
        fresh: true
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGmailAuth = async () => {
    setError('')
    setGmailAuthLoading(true)
    try {
      const response = await fetch('/api/email/gmail/auth')
      const data = await readApiResponse(response, 'Failed to initiate Gmail authorization')
      const popup = window.open(data.auth_url, 'webassure-gmail-auth', 'width=520,height=680')
      if (!popup) throw new Error('Your browser blocked the Gmail sign-in window. Allow pop-ups and try again.')
    } catch (err) {
      setError(err.message)
    } finally {
      setGmailAuthLoading(false)
    }
  }

  const handleGmailListMessages = async () => {
    if (!gmailUser?.email) return setError('Please connect Gmail first')
    setGmailLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/email/gmail/messages?user_email=${encodeURIComponent(gmailUser.email)}&query=${encodeURIComponent(gmailQuery)}&max_results=20`)
      const data = await readApiResponse(response, 'Failed to fetch Gmail messages')
      setGmailMessages(data.messages || [])
      setGmailPageToken(data.nextPageToken || null)
    } catch (err) {
      if (err.status === 401) {
        setGmailConnected(false)
        setGmailUser(null)
      }
      setError(err.message)
    } finally {
      setGmailLoading(false)
    }
  }

  const handleGmailAnalyze = async () => {
    if (!gmailUser?.email) return setError('Please connect Gmail first')
    if (selectedGmailMessages.length === 0) return setError('Please select messages to analyze')
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/email/gmail/analyze?user_email=${encodeURIComponent(gmailUser.email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_ids: selectedGmailMessages
        })
      })
      const data = await readApiResponse(response, 'Gmail message analysis failed')
      // For multiple messages, we'll show the first result
      if (data.results && data.results.length > 0) {
        const firstResult = data.results[0]
        if (!firstResult.error) {
          setReport(firstResult)
          setActiveTab('results')
          addScan({
            id: firstResult.id,
            url: `email:${firstResult.subject || 'Email analysis'}`,
            risk: firstResult.risk_score,
            category: 'Email Analysis',
            when: 'Just now',
            source: 'Gmail',
            findings: firstResult.indicators.map(i => `${i.type}: ${i.evidence}`),
            fresh: true
          })
        } else {
          setError(firstResult.error)
        }
      }
    } catch (err) {
      if (err.status === 401) {
        setGmailConnected(false)
        setGmailUser(null)
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHead title="Email Analysis" sub="Analyze emails for phishing, scams, and suspicious indicators." />

      {error && <div className="dash__err" role="alert">{error}</div>}

      <div className="card panel">
        <div className="toolbar">
          <Tabs value={activeTab} onChange={setActiveTab} options={[
            ['input', 'Analyze Email', 0],
            ['gmail', 'Gmail Integration', 0],
            ...(report ? [['results', 'Results', 0]] : [])
          ]} />
        </div>

        {activeTab === 'input' && (
          <div className="email-input-section">
            <div className="input-tabs">
              <button type="button" className={`input-tab${inputMethod === 'text' ? ' active' : ''}`} onClick={() => { setInputMethod('text'); setError('') }}>Paste Text</button>
              <button type="button" className={`input-tab${inputMethod === 'file' ? ' active' : ''}`} onClick={() => { setInputMethod('file'); setError(''); fileInputRef.current?.click() }}>Upload .eml</button>
            </div>
            <input
              ref={fileInputRef}
              id="eml-file"
              type="file"
              accept=".eml,message/rfc822"
              className="email-file-picker"
              onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setError('') }}
            />

            {inputMethod === 'text' && (
              <form onSubmit={handleTextSubmit} className="email-form">
                <label htmlFor="email-text" className="form-label">Email Content (headers + body)</label>
                <textarea
                  id="email-text"
                  className="email-textarea"
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder={`
From: sender@example.com
To: recipient@test.com
Subject: URGENT: Account Verification Required
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>
Authentication-Results: mx.example.com; spf=fail; dkim=fail; dmarc=fail

Dear Customer,

Your account has been suspended. Please verify immediately: https://phishing-site.xyz/verify

Provide your OTP and password to restore access.
                  `}
                  rows={20}
                  spellCheck={false}
                />
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={loading || !emailText.trim()}>
                    {loading ? <LoaderIcon size={16} /> : <>Analyze Email <LinkIcon size={14} /></>}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setEmailText('')}>Clear</button>
                </div>
              </form>
            )}

            {inputMethod === 'file' && (
              <form onSubmit={handleFileSubmit} className="email-form">
                <label className="form-label">Upload .eml File</label>
                <div className="file-dropzone">
                  <label htmlFor="eml-file" className="file-label">
                    <FileIcon size={32} />
                    <span>{selectedFile ? selectedFile.name : 'Drag and drop or click to select an .eml file'}</span>
                    <small>Maximum 500 KB</small>
                  </label>
                </div>
                {selectedFile && (
                  <div className="file-selected">
                    <FileIcon size={16} />
                    <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelectedFile(null)}>Remove</button>
                  </div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={loading || !selectedFile}>
                    {loading ? <LoaderIcon size={16} /> : <>Analyze File <LinkIcon size={14} /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === 'gmail' && (
          <div className="gmail-section">
            {!gmailConnected ? (
              <div className="gmail-connect">
                <div className="gmail-connect-card">
                  <GmailIcon size={48} />
                  <h3>Connect Gmail</h3>
                  <p>Securely connect your Gmail account to scan emails directly from your inbox.</p>
                  <ul className="gmail-features">
                    <li><CheckIcon size={16} /> Read-only access to messages</li>
                    <li><CheckIcon size={16} /> No emails are stored or modified</li>
                    <li><CheckIcon size={16} /> OAuth 2.0 secure authentication</li>
                    <li><CheckIcon size={16} /> Analyze multiple emails at once</li>
                  </ul>
                  <button className="btn btn--primary btn--lg" onClick={handleGmailAuth} disabled={gmailAuthLoading}>
                    {gmailAuthLoading ? <LoaderIcon size={18} /> : <GmailIcon size={18} />} {gmailAuthLoading ? 'Connecting…' : 'Connect Gmail Account'}
                  </button>
                  <p className="gmail-note">You will be redirected to Google for authorization.</p>
                </div>
              </div>
            ) : (
              <div className="gmail-connected">
                <div className="gmail-user-info">
                  <div className="gmail-avatar">
                    {gmailUser?.picture ? <img src={gmailUser.picture} alt="" /> : <span>{gmailUser?.name?.[0] || 'U'}</span>}
                  </div>
                  <div>
                    <p className="gmail-user-name">{gmailUser?.name}</p>
                    <p className="gmail-user-email">{gmailUser?.email}</p>
                  </div>
                  <button className="btn btn--ghost" onClick={() => { setGmailConnected(false); setGmailUser(null); }}>Disconnect</button>
                </div>

                <div className="gmail-search">
                  <input
                    type="text"
                    className="gmail-search-input"
                    placeholder="Gmail search query (e.g., is:unread, from:bank.com)"
                    value={gmailQuery}
                    onChange={(e) => setGmailQuery(e.target.value)}
                  />
                  <button className="btn btn--ink" onClick={handleGmailListMessages} disabled={gmailLoading}>
                    {gmailLoading ? <LoaderIcon size={16} /> : 'Search Messages'}
                  </button>
                </div>

                {gmailMessages.length > 0 && (
                  <div className="gmail-messages">
                    <h4>{gmailMessages.length} message(s) found</h4>
                    <div className="message-list">
                      {gmailMessages.map((msg) => (
                        <label key={msg.id} className="message-item">
                          <input
                            type="checkbox"
                            checked={selectedGmailMessages.includes(msg.id)}
                            onChange={(e) => setSelectedGmailMessages(e.target.checked
                              ? [...selectedGmailMessages, msg.id]
                              : selectedGmailMessages.filter(id => id !== msg.id)
                            )}
                          />
                          <div className="message-preview">
                            <p className="message-subject">{msg.headers?.subject || '(no subject)'}</p>
                            <p className="message-meta">
                              <span>{msg.headers?.from || 'Unknown sender'}</span>
                              <span>{msg.internalDate ? formatDate(parseInt(msg.internalDate) * 1000) : ''}</span>
                            </p>
                            <p className="message-snippet">{msg.snippet}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="gmail-actions">
                      <button className="btn btn--primary" onClick={handleGmailAnalyze} disabled={loading || selectedGmailMessages.length === 0}>
                        Analyze Selected ({selectedGmailMessages.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && report && (
          <div className="email-results">
            <div className="results-header">
              <div className="results-summary">
                <div className="results-classification">
                  <span className="classification-label">Classification</span>
                  <Badge tone={classificationTone(report.classification)} className="classification-badge">
                    {classificationLabel(report.classification)}
                  </Badge>
                </div>
                <div className="results-score">
                  <span className="score-label">Risk Score</span>
                  <RiskCell risk={report.risk_score} tone={classificationTone(report.classification)} />
                </div>
                <div className="results-meta">
                  <p><strong>Sender:</strong> {report.sender}</p>
                  <p><strong>Subject:</strong> {report.subject}</p>
                  <p><strong>Analyzed:</strong> {formatDate(report.analyzed_at)}</p>
                  <p><strong>ID:</strong> {report.id.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="results-actions">
                <button className="btn btn--ghost" onClick={exportReport}>
                  <DownloadIcon size={16} /> Export JSON
                </button>
                <button className="btn btn--ink" onClick={() => { setReport(null); setActiveTab('input'); }}>
                  New Analysis
                </button>
              </div>
            </div>

            <div className="results-tabs">
              <Tabs value={report.activeResultTab || 'indicators'} onChange={(v) => setReport({...report, activeResultTab: v})} options={[
                ['indicators', 'Indicators', report.indicators?.length || 0],
                ['authentication', 'Authentication', 0],
                ['urls', 'URLs', report.urls?.length || 0],
                ['attachments', 'Attachments', report.attachments?.length || 0],
                ['ai', 'AI Explanation', 0]
              ]} />
            </div>

            {(report.activeResultTab || 'indicators') === 'indicators' && (
              <div className="results-panel">
                {report.indicators && report.indicators.length > 0 ? (
                  <ul className="indicators-list">
                    {report.indicators.map((indicator, i) => (
                      <li key={i} className="indicator-item">
                        <div className="indicator-header">
                          <IndicatorBadge indicator={indicator} />
                          <span className="indicator-type">{indicator.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="indicator-evidence">{indicator.evidence}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No indicators found" text="No suspicious patterns were detected in this email." />
                )}
              </div>
            )}

            {(report.activeResultTab || 'indicators') === 'authentication' && (
              <div className="results-panel auth-panel">
                <AuthRow label="SPF" value={report.authentication?.spf || 'NONE'} details={report.authentication?.details} />
                <AuthRow label="DKIM" value={report.authentication?.dkim || 'NONE'} details={report.authentication?.details} />
                <AuthRow label="DMARC" value={report.authentication?.dmarc || 'NONE'} details={report.authentication?.details} />
                <div className="auth-legend">
                  <p><Badge tone="ok">PASS</Badge> Authentication passed</p>
                  <p><Badge tone="warn">NONE</Badge> Header not present</p>
                  <p><Badge tone="bad">FAIL</Badge> Authentication failed</p>
                  <p><Badge tone="warn">SOFTFAIL</Badge> Soft failure (SPF)</p>
                </div>
              </div>
            )}

            {(report.activeResultTab || 'indicators') === 'urls' && (
              <div className="results-panel">
                {report.urls && report.urls.length > 0 ? (
                  <div className="urls-list">
                    {report.urls.map((url, i) => (
                      <div key={i} className="url-card">
                        <UrlRow url={url} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="No URLs found" text="No URLs were extracted from this email." />
                )}
              </div>
            )}

            {(report.activeResultTab || 'indicators') === 'attachments' && (
              <div className="results-panel">
                {report.attachments && report.attachments.length > 0 ? (
                  <div className="attachments-list">
                    {report.attachments.map((att, i) => (
                      <div key={i} className="attachment-card">
                        <AttachmentRow attachment={att} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="No attachments" text="No attachments were found in this email." />
                )}
              </div>
            )}

            {(report.activeResultTab || 'indicators') === 'ai' && (
              <div className="results-panel">
                <AiExplanation explanation={report.ai_explanation} />
              </div>
            )}

            {report.recommendations && report.recommendations.length > 0 && (
              <div className="results-panel recommendations-panel">
                <h3>Recommendations</h3>
                <ul>
                  {report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
