import { pgTable, text, varchar, timestamp, integer, serial, jsonb } from 'drizzle-orm/pg-core';

export const agents = pgTable('ai_agents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  defaultModel: varchar('default_model', { length: 128 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable('ai_documents', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 32 }).notNull(),
  mimeType: varchar('mime_type', { length: 128 }),
  size: integer('size'),
  storagePath: varchar('storage_path', { length: 512 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('ai_document_chunks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: text('embedding').notNull(),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }).notNull(),
  externalUserId: varchar('external_user_id', { length: 255 }),
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  role: varchar('role', { length: 16 }).notNull(), // user | assistant | system
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const capabilities = pgTable('ai_capabilities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 32 }).notNull(),
  config: jsonb('config'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const capabilitySecrets = pgTable('ai_capability_secrets', {
  id: serial('id').primaryKey(),
  capabilityId: varchar('capability_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
