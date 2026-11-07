// Soft "plastic squish" sounds, synthesised with Web Audio (no files).
// Created lazily on the first press, as browsers require a user gesture.

let ctx = null
let master = null

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noise(c, dur) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  return src
}

// Low, muffled press: a filtered air puff plus a soft thump. Strength 0–1.
export function squishDown(strength = 0.6) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const s = Math.max(0.2, Math.min(1, strength))

  const n = noise(c, 0.22)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900, t)
  bp.frequency.exponentialRampToValueAtTime(260, t + 0.18)
  bp.Q.value = 1.4
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.32 * s, t + 0.012)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  n.connect(bp).connect(ng).connect(master)
  n.start(t)
  n.stop(t + 0.22)

  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.45 * s, t + 0.008)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 0.18)
}

// Lighter, higher pop as the plastic springs back.
export function squishUp(strength = 0.6) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const s = Math.max(0.2, Math.min(1, strength))

  const n = noise(c, 0.12)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(700, t)
  bp.frequency.exponentialRampToValueAtTime(1800, t + 0.08)
  bp.Q.value = 2
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.18 * s, t + 0.006)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  n.connect(bp).connect(ng).connect(master)
  n.start(t)
  n.stop(t + 0.12)

  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(320, t)
  o.frequency.exponentialRampToValueAtTime(520, t + 0.06)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.12 * s, t + 0.005)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 0.1)
}
