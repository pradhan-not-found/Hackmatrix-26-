// Sign-in callback and password reset are never indexed.
export const metadata = { robots: { index: false, follow: false } }

export default function AuthLayout({ children }) {
  return children
}
