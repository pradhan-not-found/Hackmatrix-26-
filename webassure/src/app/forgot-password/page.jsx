import ForgotPassword from '../../views/ForgotPassword.jsx'
import { pageMeta } from '../../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'Reset password',
  description: 'Reset your WebAssure password.',
  path: '/forgot-password',
  noindex: true,
})

export default function Page() {
  return <ForgotPassword />
}
