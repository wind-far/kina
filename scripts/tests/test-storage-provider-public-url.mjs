#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolveProviderPublicUploadUrl } from '../../server/storage/service.ts'

assert.equal(
  resolveProviderPublicUploadUrl('/uploads/reference/demo.png', {
    VIDEO_REFERENCE_PUBLIC_BASE_URL: 'https://canvas.example.com/app',
  }),
  'https://canvas.example.com/uploads/reference/demo.png',
)
assert.equal(
  resolveProviderPublicUploadUrl('https://cdn.example.com/reference/demo.png', {}),
  'https://cdn.example.com/reference/demo.png',
)
assert.equal(resolveProviderPublicUploadUrl('/uploads/reference/demo.png', {}), '')
assert.equal(resolveProviderPublicUploadUrl('http://cdn.example.com/reference/demo.png', {}), '')
assert.equal(resolveProviderPublicUploadUrl('https://127.0.0.1/reference/demo.png', {}), '')
assert.equal(resolveProviderPublicUploadUrl('https://user:pass@cdn.example.com/reference/demo.png', {}), '')
assert.equal(resolveProviderPublicUploadUrl('https://[::ffff:127.0.0.1]/reference/demo.png', {}), '')

for (const baseUrl of [
  'http://localhost:5409',
  'http://app.local',
  'http://127.0.0.1:5409',
  'http://10.0.0.8',
  'http://172.16.0.8',
  'http://192.168.1.8',
  'http://169.254.1.8',
  'http://[::1]:5409',
  'file:///tmp/uploads',
]) {
  assert.throws(
    () => resolveProviderPublicUploadUrl('/uploads/reference/demo.png', {
      VIDEO_REFERENCE_PUBLIC_BASE_URL: baseUrl,
    }),
    /VIDEO_REFERENCE_PUBLIC_BASE_URL.*公网 HTTPS/,
  )
}

console.log('storage provider public URL regression passed')
