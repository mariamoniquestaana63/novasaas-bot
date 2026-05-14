-- scripts/setup_db.sql
-- Run this in your Supabase SQL Editor to enable pgvector and create the necessary tables.

-- 1. Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the chat_logs table if it doesn't exist (Session persistence)
CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the agent_memory table for long-term memory (pgvector)
CREATE TABLE IF NOT EXISTS agent_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- 1536 is the dimension for text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create a similarity search function
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_session_id text
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM agent_memory am
  WHERE am.session_id = filter_session_id
    AND 1 - (am.embedding <=> query_embedding) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Create the blackboard_entries table for Agent IPC
CREATE TABLE IF NOT EXISTS blackboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES blackboard_entries(id),
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL, -- observation, hypothesis, plan, fact, result, error
  layer TEXT NOT NULL, -- strategy, logic, perception, action
  payload JSONB NOT NULL,
  confidence FLOAT,
  tags TEXT[],
  status TEXT DEFAULT 'active', -- active, processed, stale, archived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_blackboard_session ON blackboard_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_blackboard_type_status ON blackboard_entries(type, status);

