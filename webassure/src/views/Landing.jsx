'use client'

import { useCallback, useState } from 'react'
import Header from '../components/Header.jsx'
import Hero from '../components/Hero.jsx'
import WhatWeDo from '../components/WhatWeDo.jsx'
import Steps from '../components/Steps.jsx'
import Audience from '../components/Audience.jsx'
import Pricing from '../components/Pricing.jsx'
import { Report, Faq, Cta } from '../components/Sections.jsx'
import Footer from '../components/Footer.jsx'
import Preloader from '../components/Preloader.jsx'
import { useReveal } from '../lib/useReveal.js'

// Module scope survives client-side navigation, so the preloader plays once per page load.
let preloaded = false

export default function Landing() {
  const [loading, setLoading] = useState(() => !preloaded)
  const done = useCallback(() => {
    preloaded = true
    setLoading(false)
  }, [])
  useReveal()

  return (
    <>
      {loading && <Preloader onDone={done} />}
      <Header />
      <main id="main">
        <Hero />
        <WhatWeDo />
        <Steps />
        <Audience />
        <Report />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  )
}
