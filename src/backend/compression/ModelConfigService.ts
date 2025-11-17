import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { modelConfigs, type SelectModelConfig, type InsertModelConfig } from '@backend/db/schema'
import logger from '@backend/logger'

const log = logger.child('compression:model-config')

export interface ModelConfig {
  id: string // "provider:model"
  provider: string // openai, anthropic, google, azure
  model: string // Model name
  maxInputTokens: number // Maximum input context tokens
  maxOutputTokens: number // Maximum response tokens
  defaultCompressionThreshold: number // 0-1
  recommendedRetentionTokens: number
  source: 'api' | 'manual' | 'default'
  lastUpdated: Date
  createdAt: Date
}

// Default model configurations based on known models as of January 2025
const DEFAULT_CONFIGS: Omit<ModelConfig, 'lastUpdated' | 'createdAt'>[] = [
  // OpenAI models
  {
    id: 'openai:gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 8000,
    source: 'default'
  },
  {
    id: 'openai:gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 8000,
    source: 'default'
  },
  {
    id: 'openai:gpt-4-turbo',
    provider: 'openai',
    model: 'gpt-4-turbo',
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 8000,
    source: 'default'
  },
  {
    id: 'openai:gpt-3.5-turbo',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxInputTokens: 16385,
    maxOutputTokens: 4096,
    defaultCompressionThreshold: 0.90,
    recommendedRetentionTokens: 4000,
    source: 'default'
  },
  // Anthropic models
  {
    id: 'anthropic:claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxInputTokens: 136000,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 10000,
    source: 'default'
  },
  {
    id: 'anthropic:claude-haiku-4-5-20250929',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20250929',
    maxInputTokens: 136000,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 10000,
    source: 'default'
  },
  {
    id: 'anthropic:claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 16000,
    source: 'default'
  },
  {
    id: 'anthropic:claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.95,
    recommendedRetentionTokens: 16000,
    source: 'default'
  },
  // Google models
  {
    id: 'google:gemini-2.0-flash-exp',
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.98,
    recommendedRetentionTokens: 20000,
    source: 'default'
  },
  {
    id: 'google:gemini-2.0-flash-thinking-exp',
    provider: 'google',
    model: 'gemini-2.0-flash-thinking-exp',
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.98,
    recommendedRetentionTokens: 20000,
    source: 'default'
  },
  {
    id: 'google:gemini-exp-1206',
    provider: 'google',
    model: 'gemini-exp-1206',
    maxInputTokens: 2097152,
    maxOutputTokens: 8192,
    defaultCompressionThreshold: 0.98,
    recommendedRetentionTokens: 20000,
    source: 'default'
  }
]

export class ModelConfigService {
  private db: ReturnType<typeof drizzle>

  constructor(database: ReturnType<typeof drizzle>) {
    this.db = database
  }

  /**
   * Get configuration for a specific model
   * Auto-detects from API if not found in database
   */
  async getConfig(provider: string, model: string): Promise<ModelConfig> {
    const id = `${provider}:${model}`

    // Try to get from database
    const configs = await this.db.select().from(modelConfigs).where(eq(modelConfigs.id, id))

    if (configs.length > 0) {
      return this.toModelConfig(configs[0])
    }

    // Try to detect from API
    log.info(`Model config not found for ${id}, attempting API detection`)
    const detected = await this.detectFromAPI(provider, model)
    if (detected) {
      await this.saveConfig(detected)
      return detected
    }

    // Fall back to conservative defaults
    log.warn(`Could not detect config for ${id}, using conservative defaults`)
    const fallback: ModelConfig = {
      id,
      provider,
      model,
      maxInputTokens: 8000, // Conservative default
      maxOutputTokens: 2000,
      defaultCompressionThreshold: 0.90,
      recommendedRetentionTokens: 2000,
      source: 'default',
      lastUpdated: new Date(),
      createdAt: new Date()
    }
    await this.saveConfig(fallback)
    return fallback
  }

  /**
   * Attempt to detect model configuration from API metadata
   * Returns null if detection fails
   */
  async detectFromAPI(provider: string, model: string): Promise<ModelConfig | null> {
    // TODO: Implement API detection for different providers
    // This would query the provider's API to get model metadata
    // For now, return null to indicate detection is not implemented
    log.debug(`API detection not yet implemented for ${provider}:${model}`)
    return null
  }

  /**
   * Save or update a model configuration
   */
  async saveConfig(config: ModelConfig): Promise<void> {
    const now = new Date()
    const insert: InsertModelConfig = {
      id: config.id,
      provider: config.provider,
      model: config.model,
      maxInputTokens: config.maxInputTokens,
      maxOutputTokens: config.maxOutputTokens,
      defaultCompressionThreshold: config.defaultCompressionThreshold,
      recommendedRetentionTokens: config.recommendedRetentionTokens,
      source: config.source,
      lastUpdated: now,
      createdAt: config.createdAt || now
    }

    await this.db
      .insert(modelConfigs)
      .values(insert)
      .onConflictDoUpdate({
        target: modelConfigs.id,
        set: {
          maxInputTokens: insert.maxInputTokens,
          maxOutputTokens: insert.maxOutputTokens,
          defaultCompressionThreshold: insert.defaultCompressionThreshold,
          recommendedRetentionTokens: insert.recommendedRetentionTokens,
          source: insert.source,
          lastUpdated: now
        }
      })

    log.info(`Saved model config: ${config.id}`)
  }

  /**
   * Get all stored model configurations
   */
  async getAllConfigs(): Promise<ModelConfig[]> {
    const configs = await this.db.select().from(modelConfigs)
    return configs.map((c) => this.toModelConfig(c))
  }

  /**
   * Update specific fields of a model configuration
   */
  async updateConfig(id: string, updates: Partial<ModelConfig>): Promise<void> {
    const now = new Date()
    const updateData: Partial<InsertModelConfig> = {
      lastUpdated: now
    }

    if (updates.maxInputTokens !== undefined) {
      updateData.maxInputTokens = updates.maxInputTokens
    }
    if (updates.maxOutputTokens !== undefined) {
      updateData.maxOutputTokens = updates.maxOutputTokens
    }
    if (updates.defaultCompressionThreshold !== undefined) {
      updateData.defaultCompressionThreshold = updates.defaultCompressionThreshold
    }
    if (updates.recommendedRetentionTokens !== undefined) {
      updateData.recommendedRetentionTokens = updates.recommendedRetentionTokens
    }
    if (updates.source !== undefined) {
      updateData.source = updates.source
    }

    await this.db.update(modelConfigs).set(updateData).where(eq(modelConfigs.id, id))

    log.info(`Updated model config: ${id}`)
  }

  /**
   * Delete a model configuration
   */
  async deleteConfig(id: string): Promise<void> {
    await this.db.delete(modelConfigs).where(eq(modelConfigs.id, id))
    log.info(`Deleted model config: ${id}`)
  }

  /**
   * Seed database with default model configurations
   * Only inserts configs that don't already exist
   */
  async seedDefaults(): Promise<number> {
    const now = new Date()
    let insertedCount = 0

    for (const defaultConfig of DEFAULT_CONFIGS) {
      const existing = await this.db
        .select()
        .from(modelConfigs)
        .where(eq(modelConfigs.id, defaultConfig.id))

      if (existing.length === 0) {
        await this.saveConfig({
          ...defaultConfig,
          lastUpdated: now,
          createdAt: now
        })
        insertedCount++
      }
    }

    if (insertedCount > 0) {
      log.info(`Seeded ${insertedCount} default model configurations`)
    }

    return insertedCount
  }

  /**
   * Convert database model to ModelConfig interface
   */
  private toModelConfig(dbModel: SelectModelConfig): ModelConfig {
    return {
      id: dbModel.id,
      provider: dbModel.provider,
      model: dbModel.model,
      maxInputTokens: dbModel.maxInputTokens,
      maxOutputTokens: dbModel.maxOutputTokens,
      defaultCompressionThreshold: dbModel.defaultCompressionThreshold,
      recommendedRetentionTokens: dbModel.recommendedRetentionTokens,
      source: dbModel.source as 'api' | 'manual' | 'default',
      lastUpdated: new Date(dbModel.lastUpdated),
      createdAt: new Date(dbModel.createdAt)
    }
  }
}
