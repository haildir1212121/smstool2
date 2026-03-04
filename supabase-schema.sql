-- ============================================================
-- Supabase Schema for SMS Tool
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. THREADS TABLE
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'dispatch_team_main',
  phone TEXT,
  name TEXT,
  last_message_text TEXT,
  last_message_at_ms BIGINT DEFAULT 0,
  last_read_at_ms BIGINT DEFAULT 0,
  unread INTEGER DEFAULT 0,
  is_urgent BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MESSAGES TABLE
CREATE TABLE messages (
  id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  body TEXT,
  direction TEXT,
  sid TEXT,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, id)
);

-- 3. LOGS TABLE
CREATE TABLE logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'dispatch_team_main',
  type TEXT,
  thread_name TEXT,
  phone TEXT,
  message TEXT,
  thread_id TEXT,
  count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES
CREATE INDEX idx_threads_org_last_msg ON threads(org_id, last_message_at_ms DESC);
CREATE INDEX idx_messages_thread_created ON messages(thread_id, created_at ASC);
CREATE INDEX idx_logs_org_created ON logs(org_id, created_at DESC);

-- 5. AUTO-UPDATE updated_at ON THREADS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. INCREMENT UNREAD (atomic, single round-trip)
CREATE OR REPLACE FUNCTION increment_unread(p_thread_id TEXT, p_org_id TEXT DEFAULT 'dispatch_team_main')
RETURNS void AS $$
  UPDATE threads SET unread = COALESCE(unread, 0) + 1, updated_at = NOW()
  WHERE id = p_thread_id AND org_id = p_org_id;
$$ LANGUAGE sql;

-- 7. ROW LEVEL SECURITY (open for now — add auth policies later)
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_open" ON threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "messages_open" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "logs_open" ON logs FOR ALL USING (true) WITH CHECK (true);

-- 8. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE threads;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 9. STORAGE BUCKET (for MMS media)
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
CREATE POLICY "media_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
