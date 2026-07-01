
-- Create table to store generated text insights
CREATE TABLE IF NOT EXISTS text_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  conceptual_text TEXT NOT NULL,
  dimensional_text TEXT NOT NULL,
  concept_positions JSONB NOT NULL, -- Store snapshot of concept positions
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_text_insights_session_id ON text_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_text_insights_generated_at ON text_insights(generated_at);

-- Add RLS policies for text insights
ALTER TABLE text_insights ENABLE ROW LEVEL SECURITY;

-- Allow users to view insights from their sessions
CREATE POLICY "Users can view insights from their sessions" ON text_insights
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM game_sessions WHERE user_id = auth.uid()
    )
  );

-- Allow anonymous users to view insights from anonymous sessions
CREATE POLICY "Anonymous users can view insights from anonymous sessions" ON text_insights
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM game_sessions WHERE user_id IS NULL
    )
  );

-- Create table to track concept movement states
CREATE TABLE IF NOT EXISTS concept_movement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL,
  last_moved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_stable BOOLEAN DEFAULT FALSE,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_movement_session_concept 
  ON concept_movement_tracking(session_id, concept_id);

-- Add RLS policies for movement tracking
ALTER TABLE concept_movement_tracking ENABLE ROW LEVEL SECURITY;

-- Allow users to manage tracking for their sessions
CREATE POLICY "Users can manage tracking for their sessions" ON concept_movement_tracking
  FOR ALL USING (
    session_id IN (
      SELECT id FROM game_sessions WHERE user_id = auth.uid()
    )
  );

-- Allow anonymous users to manage tracking for anonymous sessions
CREATE POLICY "Anonymous users can manage tracking for anonymous sessions" ON concept_movement_tracking
  FOR ALL USING (
    session_id IN (
      SELECT id FROM game_sessions WHERE user_id IS NULL
    )
  );

-- Add session time limits to game_sessions table
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS max_duration INTEGER DEFAULT 120, -- 2 minutes for authenticated users
ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE;

-- Create function to check session expiry
CREATE OR REPLACE FUNCTION check_session_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Set max duration based on user authentication
  IF NEW.user_id IS NULL THEN
    NEW.max_duration := 60; -- 1 minute for anonymous users
  ELSE
    NEW.max_duration := 120; -- 2 minutes for authenticated users
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set max duration on session creation
DROP TRIGGER IF EXISTS trigger_set_session_duration ON game_sessions;
CREATE TRIGGER trigger_set_session_duration
  BEFORE INSERT ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_session_expiry();
