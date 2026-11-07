import Shell from '../../views/dashboard/Shell.jsx'

export const metadata = { robots: { index: false, follow: false } }

export default function DashboardLayout({ children }) {
  return <Shell>{children}</Shell>
}
