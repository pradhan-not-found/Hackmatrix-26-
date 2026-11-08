# Email analysis dashboard

Open `/dashboard/email-analysis` or choose **Email analysis** in the sidebar.
The page uses the existing FastAPI email analysis engine through a same-origin,
authenticated Next.js proxy. Restart FastAPI after pulling these changes.

## Inputs and results

- **Paste email:** paste the original message, including sender/subject headers
  and body. The sample button provides a self-contained scam example.
- **Raw headers:** paste the header block copied from the original message.
- **Upload .eml:** upload an RFC 5322 email file, up to 500,000 bytes.

Results include the heuristic assessment and indicator score, sender and subject,
individual findings, reported SPF/DKIM/DMARC evidence, URL scan results, attachment
metadata, recommendations, explanation, limitations and JSON export. All email
content is rendered as escaped text; HTML, scripts and attachments are not opened.
Links found in messages are inspected by the existing bounded backend URL scanner.
Messages with multiple links can take several minutes. No automatic retry is made
after a timeout: refresh history before submitting again.

Gemini is off by default. The explicit checkbox shares selected findings and
evidence snippets with the existing Gemini email-explanation service. Opening a
saved report does not regenerate its explanation or spend AI tokens.

## Authentication and storage

These endpoints require a bearer session verified by the same Supabase Auth
dependency used by URL investigations:

| Method | Endpoint | Input |
| --- | --- | --- |
| POST | `/api/email/analyze` | Exactly one of `email_content` or `raw_headers`; optional `use_gemini` |
| POST | `/api/email/upload` | Multipart `file` (.eml), optional `use_gemini` |
| GET | `/api/email/results` | `limit`, `offset` |
| GET | `/api/email/results/{id}` | Owner's analysis UUID |

History is stored in the backend's SQLite `user_email_analyses` table and filtered
by the verified user ID on both list and detail reads. The client cannot choose
the owner. It uses `EMAIL_ANALYSIS_DB` or `data/email_analyses.sqlite3` by default.
No Supabase schema migration is needed. Back up and protect this backend file;
it is not automatically synchronized to Supabase Postgres.

Old entries in the unowned `email_analyses` table are preserved, but deliberately
not displayed or assigned to an arbitrary signed-in account. The browser proxy
allows only the four routes above and strips extra input/query fields. It bounds
request bytes, forwards multipart uploads without forcing a JSON content type,
and disables caching. Upload parsing runs in a worker so link inspection does not
block FastAPI's event loop.

## Interpretation limits

The backend's `SAFE` classification is displayed as **No significant indicators**,
not as a guarantee of legitimacy. Scores are weighted indicators, not calibrated
fraud probabilities. Authentication values are reported from supplied headers,
which can be forged; the system does not independently verify DKIM signatures.
Missing authentication evidence is displayed as **Not provided**. Attachments
are assessed by metadata only, never executed or malware-scanned.

Mailbox OAuth/Gmail endpoints are not exposed by this frontend integration.
This page handles manual submission and saved results; connecting an inbox is a
separate feature requiring its own account-bound OAuth flow.

## Focused verification

The backend email API tests cover text, headers, upload, validation, sign-in and
cross-account history isolation. Email proxy tests cover JSON/multipart forwarding,
UTF-8 size bounds and routing. The browser test uses real proxy/API processing with
mocked sign-in to exercise all three inputs, export, history reload and mobile layout.
