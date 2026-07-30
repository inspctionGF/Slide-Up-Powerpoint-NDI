const header = document.querySelector('[data-header]')
const nav = document.querySelector('[data-nav]')
const navToggle = document.querySelector('[data-nav-toggle]')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function updateHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 24)
}

function closeNavigation() {
  if (!nav || !navToggle) return
  nav.classList.remove('is-open')
  navToggle.setAttribute('aria-expanded', 'false')
  navToggle.setAttribute('aria-label', 'Ouvrir le menu')
  document.body.style.overflow = ''
}

navToggle?.addEventListener('click', () => {
  const isOpen = navToggle.getAttribute('aria-expanded') === 'true'
  nav?.classList.toggle('is-open', !isOpen)
  navToggle.setAttribute('aria-expanded', String(!isOpen))
  navToggle.setAttribute('aria-label', isOpen ? 'Ouvrir le menu' : 'Fermer le menu')
  document.body.style.overflow = isOpen ? '' : 'hidden'
})

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeNavigation)
})

window.addEventListener('scroll', updateHeader, { passive: true })
window.addEventListener('resize', () => {
  if (window.innerWidth > 780) closeNavigation()
})
updateHeader()

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear())
})

const revealElements = document.querySelectorAll('[data-reveal]')

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealElements.forEach((element) => element.classList.add('is-visible'))
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    },
    {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12
    }
  )

  revealElements.forEach((element) => revealObserver.observe(element))
}
