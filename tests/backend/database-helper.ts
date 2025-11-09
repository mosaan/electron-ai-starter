import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'

/**
 * Creates a fresh in-memory test database with schema setup
 */
export async function createTestDatabase(): Promise<ReturnType<typeof drizzle>> {
  // Create in-memory libSQL database
  const client = createClient({ url: ':memory:' })

  // Create Drizzle instance
  const testDb = drizzle({ client })

  // Create tables directly for testing (more reliable than migrations in test env)
  await testDb.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      "key" TEXT PRIMARY KEY NOT NULL,
      "value" TEXT NOT NULL
    )
  `)

  await testDb.run(sql`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      command TEXT NOT NULL,
      args TEXT NOT NULL,
      env TEXT,
      enabled INTEGER DEFAULT 1 NOT NULL,
      include_resources INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  return testDb
}

/**
 * Vitest fixture for database testing
 * Sets up a fresh in-memory database before each test
 */
export function setupDatabaseTest() {
  let testDb: ReturnType<typeof drizzle>

  beforeEach(async () => {
    testDb = await createTestDatabase()
  })

  return () => testDb
}
