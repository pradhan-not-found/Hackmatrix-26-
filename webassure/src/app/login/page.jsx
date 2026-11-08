import Login from '../../views/Login.jsx'
import { pageMeta } from '../../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'Log in',
  description: 'Log in to your WebAssure dashboard to check links, sites and certificates.',
  path: '/login',
  noindex: true,
})

export default function Page() {
  return <Login mode="login" />
}
