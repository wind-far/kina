#!/usr/bin/env node
import assert from 'node:assert/strict'
import { deduplicatePublicCatalogModels } from '../../server/provider-config/catalog-dedup.ts'

const environmentProviderIds = new Set(['environment-provider'])
const models = [
  { providerId: 'environment-provider', category: 'IMAGE', modelKey: 'gpt-image-2', label: 'gpt-image-2' },
  { providerId: 'manual-provider', category: 'IMAGE', modelKey: 'gpt-image-2', label: 'gpt-image-2' },
  { providerId: 'manual-provider', category: 'CHAT', modelKey: 'gpt-image-2', label: 'gpt-image-2' },
]

const visibleModels = deduplicatePublicCatalogModels(models, environmentProviderIds)

assert.deepEqual(
  visibleModels.map(item => [item.providerId, item.category, item.modelKey]),
  [
    ['environment-provider', 'IMAGE', 'gpt-image-2'],
    ['manual-provider', 'CHAT', 'gpt-image-2'],
  ],
)

console.log('public model catalog de-duplication regression passed')
