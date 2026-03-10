
import { supabase } from '@/integrations/supabase/client';
import { Concept } from './ConceptGenerator';

export interface GameSessionData {
  id?: string;
  disciplines: string[];
  concepts: Concept[];
  interactions: Array<{
    conceptId: string;
    action: string;
    timestamp: number;
  }>;
  duration: number;
  sessionType: string;
  conceptCount: number;
}

export class GameSessionService {
  async createSession(sessionData: GameSessionData): Promise<string | null> {
    try {
      // Create the main session record
      const { data: session, error: sessionError } = await (supabase as any)
        .from('game_sessions')
        .insert({
          session_type: sessionData.sessionType,
          duration: sessionData.duration,
          concept_count: sessionData.conceptCount,
          user_id: null // Allow anonymous sessions for now
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        return null;
      }

      const sessionId = session.id;

      // Insert session disciplines
      const disciplineInserts = sessionData.disciplines.map(disciplineId => ({
        session_id: sessionId,
        discipline_id: disciplineId
      }));

      const { error: disciplinesError } = await (supabase as any)
        .from('session_disciplines')
        .insert(disciplineInserts);

      if (disciplinesError) {
        console.error('Error inserting session disciplines:', disciplinesError);
      }

      // Insert session concepts with their positions
      const conceptInserts = sessionData.concepts.map(concept => ({
        session_id: sessionId,
        concept_id: concept.id,
        x: concept.x,
        y: concept.y,
        z: concept.z,
        energy: concept.energy
      }));

      const { error: conceptsError } = await (supabase as any)
        .from('session_concepts')
        .insert(conceptInserts);

      if (conceptsError) {
        console.error('Error inserting session concepts:', conceptsError);
      }

      // Insert session interactions
      const interactionInserts = sessionData.interactions.map(interaction => ({
        session_id: sessionId,
        concept_id: interaction.conceptId,
        action: interaction.action,
        timestamp_offset: interaction.timestamp
      }));

      if (interactionInserts.length > 0) {
        const { error: interactionsError } = await (supabase as any)
          .from('session_interactions')
          .insert(interactionInserts);

        if (interactionsError) {
          console.error('Error inserting session interactions:', interactionsError);
        }
      }

      return sessionId;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  async getSession(sessionId: string): Promise<GameSessionData | null> {
    try {
      // Fetch session with related data
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select(`
          *,
          session_disciplines!inner(discipline_id),
          session_concepts!inner(
            concept_id,
            x,
            y,
            z,
            energy,
            concepts!inner(text, discipline_id)
          ),
          session_interactions(
            concept_id,
            action,
            timestamp_offset
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Error fetching session:', sessionError);
        return null;
      }

      // Transform the data into the expected format
      const concepts: Concept[] = session.session_concepts.map((sc: any) => ({
        id: sc.concept_id,
        text: sc.concepts.text,
        discipline: sc.concepts.discipline_id,
        x: sc.x,
        y: sc.y,
        z: sc.z,
        energy: sc.energy,
        connections: [] // We'll need to fetch these separately if needed
      }));

      const interactions = session.session_interactions.map((si: any) => ({
        conceptId: si.concept_id,
        action: si.action,
        timestamp: si.timestamp_offset
      }));

      return {
        id: session.id,
        disciplines: session.session_disciplines.map((sd: any) => sd.discipline_id),
        concepts,
        interactions,
        duration: session.duration || 0,
        sessionType: session.session_type,
        conceptCount: session.concept_count
      };
    } catch (error) {
      console.error('Error in getSession:', error);
      return null;
    }
  }

  async updateSessionDuration(sessionId: string, duration: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          duration,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session duration:', error);
      }
    } catch (error) {
      console.error('Error in updateSessionDuration:', error);
    }
  }

  async getRecentSessions(limit: number = 10): Promise<GameSessionData[]> {
    try {
      const { data: sessions, error } = await supabase
        .from('game_sessions')
        .select(`
          *,
          session_disciplines!inner(discipline_id)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent sessions:', error);
        return [];
      }

      return sessions.map(session => ({
        id: session.id,
        disciplines: session.session_disciplines.map((sd: any) => sd.discipline_id),
        concepts: [], // Not loaded for recent sessions list
        interactions: [],
        duration: session.duration || 0,
        sessionType: session.session_type,
        conceptCount: session.concept_count
      }));
    } catch (error) {
      console.error('Error in getRecentSessions:', error);
      return [];
    }
  }
}

export const gameSessionService = new GameSessionService();
