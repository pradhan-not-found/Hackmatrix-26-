import Login from '../../views/Login.jsx'

export const metadata = {
  title: 'Log in',
  description: 'Log in to your WebAssure dashboard.',
  alternates: { canonical: '/login' },
}

export default function Page() {
  return <Login mode="login" />
}
