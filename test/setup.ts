import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Pusher
vi.mock('pusher-js', () => ({
  default: {
    connection: {
      state: 'connected',
      bind: vi.fn(),
      unbind: vi.fn(),
    },
    subscribe: vi.fn(() => ({
      bind: vi.fn(),
      unbind: vi.fn(),
    })),
    unsubscribe: vi.fn(),
    channel: vi.fn(),
  },
}))

// Mock QR Code library
vi.mock('qrcode', () => ({
  toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock-qrcode-data')),
}))

// Mock fetch globally
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
})

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

declare global {
  namespace Vi {
    interface Assertion {
      toBeWithinRange(floor: number, ceiling: number): any
    }
  }
}