import Login from '../../views/Login.jsx'

export const metadata = {
  title: 'Create account',
  description: 'Create a free WebAssure account and start checking links, sites and certificates.',
  alternates: { canonical: '/signup' },
}

export default function Page() {
  return <Login mode="signup" />
}
