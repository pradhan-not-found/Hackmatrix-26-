import Download from '../../views/Download.jsx'

export const metadata = {
  title: 'Pitch deck',
  description: 'Preview and download the WebAssure pitch deck.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Download />
}
