'use client'

import { useEffect, useState } from 'react'

const SCRIPT =
  'Hi, this is WebAssure. We help you know a website before you trust it. ' +
  'Got a link in a message, an email or an ad that feels a little off? Paste it in. ' +
  'In a few seconds you will know whether it is safe, suspicious or a scam, ' +
  'and exactly why, explained in plain language. ' +
  'No downloads, no setup, and you never have to open the risky page yourself. ' +
  'Every scam you report helps protect everyone else too. ' +
  'WebAssure. Know your website, trust every link, and click with confidence.'

function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => /en-(GB|US)/.test(v.lang) && /Natural|Google|Samantha|Aria|Jenny/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  )
}

export default function VoiceOrb() {
  // Detected after mount so server and client render the same markup.
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    setSupported(true)
    window.speechSynthesis.getVoices() // warm the voice list
    return () => window.speechSynthesis.cancel()
  }, [])

  if (!supported) return null

  const toggle = () => {
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(SCRIPT)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.rate = 1
    u.pitch = 1
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    synth.cancel()
    synth.speak(u)
    setSpeaking(true)
  }

  return (
    <button
      className="voice"
      data-on={speaking || undefined}
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? 'Stop the spoken introduction' : 'Listen to what WebAssure does'}
    >
      <span className="voice__bars" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span className="voice__tip" aria-hidden="true">{speaking ? 'Stop' : 'Listen: what is WebAssure?'}</span>
    </button>
  )
}
