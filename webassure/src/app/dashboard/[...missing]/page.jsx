import { notFound } from 'next/navigation'

// Any unknown /dashboard/* URL renders the dashboard 404 inside the app shell.
export default function Missing() {
  notFound()
}
