'use client'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      ['Link scanner', '/#top'],
      ['Features', '/#product'],
      ['How it works', '/#how'],
      ['Dashboard', '/dashboard'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['FAQ', '/#faq'],
      ['Log in', '/login'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy', '#'],
      ['Terms', '#'],
      ['Responsible disclosure', '#'],
    ],
  },
]

const SOCIAL = [
  ['GitHub', '#'],
  ['LinkedIn', '#'],
  ['X', '#'],
]

export default function Footer() {
  return (
    <footer className="site-footer wrap">
      <div className="footer__top">
        <div className="footer__brand">
          <a href="#top" className="footer__mark" aria-label="WebAssure home">webassure</a>
          <p className="grey">
            AI threat detection for links, sites and certificates. Know before you click.
          </p>
        </div>
        <nav className="footer__cols" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="footer__h">{col.title}</h2>
              <ul>
                {col.links.map(([label, href]) => (
                  <li key={label}><a href={href}>{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="footer__base">
        <p>© {new Date().getFullYear()} WebAssure. All rights reserved.</p>
        <ul className="footer__inline">
          {SOCIAL.map(([label, href]) => (
            <li key={label}><a href={href}>{label}</a></li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
