
import { supabase } from '@/integrations/supabase/client';
import { ConceptDatabaseEntry } from './types';

export class ConceptDatabaseService {
  async fetchConcepts(disciplines: string[]): Promise<ConceptDatabaseEntry[]> {
    const { data: dbConcepts, error } = await supabase
      .from('concepts')
      .select(`
        id,
        text,
        discipline_id,
        disciplines!inner(id, name, color, icon)
      `)
      .in('discipline_id', disciplines);

    if (error) {
      console.error('Error fetching concepts:', error);
      throw error;
    }

    return dbConcepts || [];
  }
}

export const conceptDatabaseService = new ConceptDatabaseService();
