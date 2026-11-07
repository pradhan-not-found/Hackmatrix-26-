import ForgotPassword from '../../views/ForgotPassword.jsx'

export const metadata = {
  title: 'Reset password',
  description: 'Reset your WebAssure password.',
  robots: { index: false },
}

export default function Page() {
  return <ForgotPassword />
}
