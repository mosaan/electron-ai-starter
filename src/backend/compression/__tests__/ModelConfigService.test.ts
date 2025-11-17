import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { ModelConfigService } from '../ModelConfigService'
import * as path from 'path'
import * as fs from 'fs'

describe('ModelConfigService', () => {
  let db: ReturnType<typeof drizzle>
  let service: ModelConfigService
  const testDbPath = ':memory:' // Use in-memory database for tests

  beforeEach(async () => {
    // Create in-memory database
    const client = createClient({ url: testDbPath })
    db = drizzle({ client })

    // Run migrations
    const migrationsFolder = path.join(process.cwd(), 'resources', 'db', 'migrations')
    if (fs.existsSync(migrationsFolder)) {
      await migrate(db, { migrationsFolder })
    }

    // Initialize service
    service = new ModelConfigService(db)
  })

  afterEach(async () => {
    // Clean up
    if (db?.$client) {
      db.$client.close()
    }
  })

  describe('seedDefaults', () => {
    it('should seed default model configurations', async () => {
      const insertedCount = await service.seedDefaults()

      expect(insertedCount).toBeGreaterThan(0)

      const allConfigs = await service.getAllConfigs()
      expect(allConfigs.length).toBeGreaterThanOrEqual(insertedCount)
    })

    it('should not duplicate configs on second seed', async () => {
      const firstCount = await service.seedDefaults()
      const secondCount = await service.seedDefaults()

      expect(secondCount).toBe(0)
      expect(firstCount).toBeGreaterThan(0)
    })

    it('should include known models', async () => {
      await service.seedDefaults()
      const allConfigs = await service.getAllConfigs()

      const providers = allConfigs.map((c) => c.provider)
      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).toContain('google')
    })
  })

  describe('getConfig', () => {
    beforeEach(async () => {
      await service.seedDefaults()
    })

    it('should retrieve existing config', async () => {
      const config = await service.getConfig('openai', 'gpt-4o')

      expect(config).toBeDefined()
      expect(config.provider).toBe('openai')
      expect(config.model).toBe('gpt-4o')
      expect(config.maxInputTokens).toBeGreaterThan(0)
    })

    it('should create fallback for unknown model', async () => {
      const config = await service.getConfig('openai', 'unknown-model')

      expect(config).toBeDefined()
      expect(config.provider).toBe('openai')
      expect(config.model).toBe('unknown-model')
      expect(config.maxInputTokens).toBe(8000) // Conservative default
      expect(config.source).toBe('default')
    })

    it('should have valid threshold values', async () => {
      const config = await service.getConfig('anthropic', 'claude-sonnet-4-5-20250929')

      expect(config.defaultCompressionThreshold).toBeGreaterThan(0)
      expect(config.defaultCompressionThreshold).toBeLessThanOrEqual(1)
    })
  })

  describe('saveConfig', () => {
    it('should save new config', async () => {
      const newConfig = {
        id: 'test:model-1',
        provider: 'test',
        model: 'model-1',
        maxInputTokens: 10000,
        maxOutputTokens: 2000,
        defaultCompressionThreshold: 0.9,
        recommendedRetentionTokens: 5000,
        source: 'manual' as const,
        lastUpdated: new Date(),
        createdAt: new Date()
      }

      await service.saveConfig(newConfig)

      const retrieved = await service.getConfig('test', 'model-1')
      expect(retrieved.id).toBe('test:model-1')
      expect(retrieved.maxInputTokens).toBe(10000)
    })

    it('should update existing config', async () => {
      const config = {
        id: 'test:model-2',
        provider: 'test',
        model: 'model-2',
        maxInputTokens: 10000,
        maxOutputTokens: 2000,
        defaultCompressionThreshold: 0.9,
        recommendedRetentionTokens: 5000,
        source: 'manual' as const,
        lastUpdated: new Date(),
        createdAt: new Date()
      }

      await service.saveConfig(config)

      // Update
      config.maxInputTokens = 20000
      await service.saveConfig(config)

      const retrieved = await service.getConfig('test', 'model-2')
      expect(retrieved.maxInputTokens).toBe(20000)
    })
  })

  describe('updateConfig', () => {
    beforeEach(async () => {
      const config = {
        id: 'test:model-3',
        provider: 'test',
        model: 'model-3',
        maxInputTokens: 10000,
        maxOutputTokens: 2000,
        defaultCompressionThreshold: 0.9,
        recommendedRetentionTokens: 5000,
        source: 'manual' as const,
        lastUpdated: new Date(),
        createdAt: new Date()
      }
      await service.saveConfig(config)
    })

    it('should update specific fields', async () => {
      await service.updateConfig('test:model-3', {
        maxInputTokens: 15000,
        defaultCompressionThreshold: 0.95
      })

      const retrieved = await service.getConfig('test', 'model-3')
      expect(retrieved.maxInputTokens).toBe(15000)
      expect(retrieved.defaultCompressionThreshold).toBe(0.95)
      expect(retrieved.maxOutputTokens).toBe(2000) // Unchanged
    })

    it('should update lastUpdated timestamp', async () => {
      const before = await service.getConfig('test', 'model-3')
      const beforeTime = before.lastUpdated.getTime()

      // Wait a bit to ensure timestamp difference (SQLite timestamps are in seconds)
      await new Promise((resolve) => setTimeout(resolve, 1100))

      await service.updateConfig('test:model-3', { maxInputTokens: 12000 })

      const after = await service.getConfig('test', 'model-3')
      expect(after.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('deleteConfig', () => {
    beforeEach(async () => {
      const config = {
        id: 'test:model-4',
        provider: 'test',
        model: 'model-4',
        maxInputTokens: 10000,
        maxOutputTokens: 2000,
        defaultCompressionThreshold: 0.9,
        recommendedRetentionTokens: 5000,
        source: 'manual' as const,
        lastUpdated: new Date(),
        createdAt: new Date()
      }
      await service.saveConfig(config)
    })

    it('should delete config', async () => {
      await service.deleteConfig('test:model-4')

      // Should create fallback when trying to get deleted config
      const retrieved = await service.getConfig('test', 'model-4')
      expect(retrieved.source).toBe('default') // Fallback created
    })
  })

  describe('getAllConfigs', () => {
    it('should return empty array when no configs exist', async () => {
      const configs = await service.getAllConfigs()
      expect(configs).toEqual([])
    })

    it('should return all configs', async () => {
      await service.seedDefaults()
      const configs = await service.getAllConfigs()

      expect(configs.length).toBeGreaterThan(0)
      configs.forEach((config) => {
        expect(config.id).toBeDefined()
        expect(config.provider).toBeDefined()
        expect(config.model).toBeDefined()
        expect(config.maxInputTokens).toBeGreaterThan(0)
      })
    })
  })
})
