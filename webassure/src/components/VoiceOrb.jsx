'use client'

import { useEffect, useRef, useState } from 'react'

// Spoken one sentence at a time so the delivery has natural pauses.
const LINES = [
  'Hi, this is WebAssure.',
  'We help you know a website before you trust it.',
  'Got a link in a message, an email or an ad that feels a little off? Just paste it in.',
  'In a few seconds, you will know whether it is safe, suspicious, or a scam, and exactly why, in plain language.',
  'There is nothing to install, and you never have to open the risky page yourself.',
  'And every scam you report helps protect everyone else.',
  'WebAssure. Know your website. Trust every link.',
]

// Highest-quality voices first: neural "Natural" voices, then Google, then any English voice.
const PREFERRED = [
  /Microsoft (Aria|Jenny|Ava|Emma|Andrew|Brian|Guy|Sonia|Libby|Neerja|Prabhat).*(Natural|Online)/i,
  /(Natural|Neural)/i,
  /Google (UK English Female|UK English Male|US English)/i,
  /Samantha|Karen|Daniel|Moira|Serena/i,
]

function pickVoice(voices) {
  const english = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
  for (const re of PREFERRED) {
    const v = english.find((x) => re.test(x.name))
    if (v) return v
  }
  return english[0] || null
}

export default function VoiceOrb() {
  // Detected after mount so server and client render the same markup.
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef(null)
  const runRef = useRef(0)

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    setSupported(true)
    const synth = window.speechSynthesis
    const load = () => {
      voiceRef.current = pickVoice(synth.getVoices())
    }
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      synth.cancel()
    }
  }, [])

  if (!supported) return null

  const stop = () => {
    runRef.current += 1
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speak = () => {
    const synth = window.speechSynthesis
    synth.cancel()
    const run = ++runRef.current
    const voice = voiceRef.current || pickVoice(synth.getVoices())
    setSpeaking(true)

    const sayLine = (i) => {
      if (run !== runRef.current) return
      if (i >= LINES.length) return setSpeaking(false)
      const u = new SpeechSynthesisUtterance(LINES[i])
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      }
      u.rate = 0.96
      u.pitch = 1
      u.volume = 1
      u.onend = () => setTimeout(() => sayLine(i + 1), 260) // short breath between sentences
      u.onerror = () => run === runRef.current && setSpeaking(false)
      synth.speak(u)
    }
    sayLine(0)
  }

  return (
    <button
      className="voice"
      data-on={speaking || undefined}
      onClick={speaking ? stop : speak}
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
