
-- Create disciplines table
CREATE TABLE public.disciplines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create concepts table
CREATE TABLE public.concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  discipline_id TEXT NOT NULL REFERENCES public.disciplines(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game sessions table
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  session_type TEXT NOT NULL DEFAULT 'exploration',
  duration INTEGER DEFAULT 0,
  concept_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session disciplines junction table
CREATE TABLE public.session_disciplines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  discipline_id TEXT NOT NULL REFERENCES public.disciplines(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session concepts table (concepts generated for specific sessions)
CREATE TABLE public.session_concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.concepts(id),
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  energy REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session interactions table
CREATE TABLE public.session_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.concepts(id),
  action TEXT NOT NULL,
  timestamp_offset INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create concept connections table
CREATE TABLE public.concept_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  concept_1_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  concept_2_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  strength REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(concept_1_id, concept_2_id)
);

-- Enable RLS on all tables
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for disciplines (public read access)
CREATE POLICY "Anyone can view disciplines" ON public.disciplines FOR SELECT USING (true);

-- Create RLS policies for concepts (public read access)
CREATE POLICY "Anyone can view concepts" ON public.concepts FOR SELECT USING (true);

-- Create RLS policies for concept connections (public read access)
CREATE POLICY "Anyone can view concept connections" ON public.concept_connections FOR SELECT USING (true);

-- Create RLS policies for game sessions (user-specific)
CREATE POLICY "Users can view their own sessions" ON public.game_sessions FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create sessions" ON public.game_sessions FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update their own sessions" ON public.game_sessions FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Create RLS policies for session disciplines
CREATE POLICY "Users can view session disciplines" ON public.session_disciplines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);
CREATE POLICY "Users can create session disciplines" ON public.session_disciplines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);

-- Create RLS policies for session concepts
CREATE POLICY "Users can view session concepts" ON public.session_concepts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);
CREATE POLICY "Users can create session concepts" ON public.session_concepts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);

-- Create RLS policies for session interactions
CREATE POLICY "Users can view session interactions" ON public.session_interactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);
CREATE POLICY "Users can create session interactions" ON public.session_interactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions WHERE id = session_id AND (auth.uid() = user_id OR user_id IS NULL))
);

-- Insert the default disciplines
INSERT INTO public.disciplines (id, name, color, icon, description) VALUES
('mathematics', 'Mathematics', '#3B82F6', '∑', 'The study of numbers, quantities, shapes, and patterns'),
('music', 'Music Theory', '#10B981', '♪', 'The language and structure of musical composition'),
('philosophy', 'Philosophy', '#8B5CF6', 'Φ', 'The study of fundamental questions about existence, knowledge, and ethics'),
('physics', 'Physics', '#F59E0B', 'Ψ', 'The study of matter, energy, and their interactions'),
('art', 'Visual Arts', '#EF4444', '◊', 'The creation and appreciation of visual beauty and meaning'),
('history', 'History & Politics', '#06B6D4', '⚖', 'The study of past events and political systems');

-- Insert sample concepts for each discipline
INSERT INTO public.concepts (text, discipline_id) VALUES
-- Mathematics concepts
('Fibonacci Sequence', 'mathematics'),
('Golden Ratio', 'mathematics'),
('Infinite Series', 'mathematics'),
('Topology', 'mathematics'),
('Prime Numbers', 'mathematics'),
('Chaos Theory', 'mathematics'),
('Fractals', 'mathematics'),
('Set Theory', 'mathematics'),
('Number Theory', 'mathematics'),
('Geometry', 'mathematics'),
('Calculus', 'mathematics'),
('Statistics', 'mathematics'),
('Probability', 'mathematics'),
('Graph Theory', 'mathematics'),
('Abstract Algebra', 'mathematics'),

-- Music concepts
('Harmonic Resonance', 'music'),
('Counterpoint', 'music'),
('Modulation', 'music'),
('Rhythm Patterns', 'music'),
('Melody Structure', 'music'),
('Timbre', 'music'),
('Dynamics', 'music'),
('Consonance', 'music'),
('Dissonance', 'music'),
('Musical Form', 'music'),
('Improvisation', 'music'),
('Polyrhythm', 'music'),
('Modal Scales', 'music'),
('Overtones', 'music'),
('Syncopation', 'music'),

-- Philosophy concepts
('Consciousness', 'philosophy'),
('Free Will', 'philosophy'),
('Ethics', 'philosophy'),
('Truth', 'philosophy'),
('Beauty', 'philosophy'),
('Justice', 'philosophy'),
('Reality', 'philosophy'),
('Knowledge', 'philosophy'),
('Existence', 'philosophy'),
('Meaning', 'philosophy'),
('Dialectics', 'philosophy'),
('Phenomenology', 'philosophy'),
('Ontology', 'philosophy'),
('Epistemology', 'philosophy'),
('Metaphysics', 'philosophy'),

-- Physics concepts
('Quantum Entanglement', 'physics'),
('Wave-Particle Duality', 'physics'),
('Relativity', 'physics'),
('Thermodynamics', 'physics'),
('Electromagnetic Fields', 'physics'),
('String Theory', 'physics'),
('Dark Matter', 'physics'),
('Energy Conservation', 'physics'),
('Momentum', 'physics'),
('Gravity', 'physics'),
('Nuclear Forces', 'physics'),
('Particle Physics', 'physics'),
('Cosmology', 'physics'),
('Fluid Dynamics', 'physics'),
('Optics', 'physics'),

-- Art concepts
('Color Theory', 'art'),
('Composition', 'art'),
('Perspective', 'art'),
('Light and Shadow', 'art'),
('Texture', 'art'),
('Form', 'art'),
('Movement', 'art'),
('Balance', 'art'),
('Contrast', 'art'),
('Harmony', 'art'),
('Symbolism', 'art'),
('Abstract Expression', 'art'),
('Realism', 'art'),
('Surrealism', 'art'),
('Minimalism', 'art'),

-- History concepts
('Cultural Evolution', 'history'),
('Social Movements', 'history'),
('Power Structures', 'history'),
('Revolution', 'history'),
('Democracy', 'history'),
('Civilization', 'history'),
('Trade Routes', 'history'),
('Diplomacy', 'history'),
('Warfare', 'history'),
('Renaissance', 'history'),
('Enlightenment', 'history'),
('Industrial Revolution', 'history'),
('Globalization', 'history'),
('Colonialism', 'history'),
('Human Rights', 'history');
