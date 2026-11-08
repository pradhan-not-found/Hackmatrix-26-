import Login from '../../views/Login.jsx'
import { pageMeta } from '../../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'Create account',
  description: 'Create a free WebAssure account and start checking links, websites and certificates in seconds.',
  path: '/signup',
})

export default function Page() {
  return <Login mode="signup" />
}
