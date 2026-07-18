-- worker/schema.sql

-- ============ ANIME ============
CREATE TABLE IF NOT EXISTS animes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  episodes INTEGER DEFAULT 0,
  genre TEXT,
  image TEXT,
  popularity INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  source TEXT DEFAULT 'anilist',
  status TEXT DEFAULT 'Ongoing',
  studio TEXT,
  trailer TEXT,
  type TEXT DEFAULT 'ANIME',
  year INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============ EPISODES ============
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  anime_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT,
  languages TEXT DEFAULT '{}',
  servers TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE,
  UNIQUE(anime_id, number)
);

-- ============ SCHEDULE ============
CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  day INTEGER NOT NULL,
  time TEXT NOT NULL,
  title TEXT,
  episode INTEGER DEFAULT 1,
  link TEXT DEFAULT '',
  anime_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE SET NULL
);

-- ============ NEWS ============
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  image TEXT,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============ FEATURED ============
CREATE TABLE IF NOT EXISTS featured (
  id TEXT PRIMARY KEY DEFAULT 'featured_ids',
  anime_ids TEXT DEFAULT '[]'
);

-- ============ NEWLY ADDED ============
CREATE TABLE IF NOT EXISTS newly_added (
  id TEXT PRIMARY KEY DEFAULT 'newly_added_ids',
  anime_ids TEXT DEFAULT '[]'
);

-- ============ REPORTS ============
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  anime_id TEXT NOT NULL,
  episode_number INTEGER,
  server_name TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (anime_id) REFERENCES animes(id) ON DELETE CASCADE
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_episodes_number ON episodes(number);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule(day);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_anime_id ON reports(anime_id);