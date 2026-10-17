// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App, { ErrorBoundary } from './App'

// Every route in App.tsx's router.
const ROUTES = ['/', '/arena', '/modes', '/play/ghost', '/play/boss', '/play/survival', '/play/code', '/play/precision', '/play/daily', '/play/zen', '/progress', '/leaderboard', '/settings']

beforeAll(() => {
  // Browser APIs jsdom lacks.
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // Current Chrome returns a Promise from scrollTo. An effect that returned it used to blank the whole app.
  window.scrollTo = (() => Promise.resolve()) as unknown as typeof window.scrollTo
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
  vi.restoreAllMocks()
})

describe('App', () => {
  it.each(ROUTES)('renders %s without hitting an error boundary', async (route) => {
    window.location.hash = `#${route}`
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Page not found')).toBeNull()
  })

  it('shows a not-found page for unknown routes', async () => {
    window.location.hash = '#/nope'
    render(<App />)
    expect(await screen.findByText('Page not found')).toBeTruthy()
  })

  it('shows the dashboard for a new player', async () => {
    render(<App />)
    expect(await screen.findByText(/Welcome to KeyQuest/)).toBeTruthy()
  })
})

describe('ErrorBoundary', () => {
  it('shows a recovery screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => {
      throw new Error('kaboom')
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/kaboom/)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })
})
