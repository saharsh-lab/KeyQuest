import { useEffect, useState } from 'react'

const read = () => {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

/** Minimal hash router: works on any static host without server rewrites. */
export function useHashRoute() {
  const [path, setPath] = useState(read)
  useEffect(() => {
    const on = () => setPath(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

export function navigate(path: string) {
  window.location.hash = path
}
