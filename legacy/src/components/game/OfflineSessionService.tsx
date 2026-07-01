import { Concept } from './OfflineConceptGenerator';

export interface OfflineSessionData {
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
  createdAt?: string;
  completedAt?: string;
}

export class OfflineSessionService {
  private readonly STORAGE_PREFIX = 'glass_bead_game_';

  async createSession(sessionData: OfflineSessionData): Promise<string | null> {
    try {
      const sessionId = crypto.randomUUID();
      const session: OfflineSessionData = {
        ...sessionData,
        id: sessionId,
        createdAt: new Date().toISOString()
      };

      // Store in localStorage
      localStorage.setItem(
        `${this.STORAGE_PREFIX}session_${sessionId}`, 
        JSON.stringify(session)
      );

      // Add to sessions index
      const sessions = this.getSessionsList();
      sessions.unshift(sessionId);
      
      // Keep only last 20 sessions
      const trimmedSessions = sessions.slice(0, 20);
      localStorage.setItem(
        `${this.STORAGE_PREFIX}sessions_index`, 
        JSON.stringify(trimmedSessions)
      );

      console.log('Created offline session:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Error creating offline session:', error);
      return null;
    }
  }

  async getSession(sessionId: string): Promise<OfflineSessionData | null> {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_PREFIX}session_${sessionId}`);
      if (!stored) return null;

      return JSON.parse(stored);
    } catch (error) {
      console.error('Error getting offline session:', error);
      return null;
    }
  }

  async updateSessionDuration(sessionId: string, duration: number): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      session.duration = duration;
      session.completedAt = new Date().toISOString();

      localStorage.setItem(
        `${this.STORAGE_PREFIX}session_${sessionId}`, 
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Error updating offline session duration:', error);
    }
  }

  async getRecentSessions(limit: number = 10): Promise<OfflineSessionData[]> {
    try {
      const sessions = this.getSessionsList();
      const recentSessions: OfflineSessionData[] = [];

      for (const sessionId of sessions.slice(0, limit)) {
        const session = await this.getSession(sessionId);
        if (session) {
          recentSessions.push(session);
        }
      }

      return recentSessions;
    } catch (error) {
      console.error('Error getting recent offline sessions:', error);
      return [];
    }
  }

  deleteSession(sessionId: string): void {
    try {
      // Remove session data
      localStorage.removeItem(`${this.STORAGE_PREFIX}session_${sessionId}`);
      
      // Remove movements data
      localStorage.removeItem(`movements-${sessionId}`);
      localStorage.removeItem(`session-${sessionId}-final`);
      
      // Update sessions index
      const sessions = this.getSessionsList();
      const updatedSessions = sessions.filter(id => id !== sessionId);
      localStorage.setItem(
        `${this.STORAGE_PREFIX}sessions_index`, 
        JSON.stringify(updatedSessions)
      );

      console.log('Deleted offline session:', sessionId);
    } catch (error) {
      console.error('Error deleting offline session:', error);
    }
  }

  exportAllSessions(): void {
    try {
      const sessions = this.getSessionsList();
      const allSessionsData: { [key: string]: any } = {};

      sessions.forEach(sessionId => {
        const session = localStorage.getItem(`${this.STORAGE_PREFIX}session_${sessionId}`);
        const movements = localStorage.getItem(`movements-${sessionId}`);
        const finalData = localStorage.getItem(`session-${sessionId}-final`);

        allSessionsData[sessionId] = {
          session: session ? JSON.parse(session) : null,
          movements: movements ? JSON.parse(movements) : null,
          finalData: finalData ? JSON.parse(finalData) : null
        };
      });

      const dataStr = JSON.stringify(allSessionsData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `glass-bead-game-all-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('All sessions exported successfully');
    } catch (error) {
      console.error('Failed to export all sessions:', error);
    }
  }

  clearAllSessions(): void {
    try {
      const sessions = this.getSessionsList();
      
      sessions.forEach(sessionId => {
        this.deleteSession(sessionId);
      });
      
      // Clear the index
      localStorage.removeItem(`${this.STORAGE_PREFIX}sessions_index`);
      
      console.log('All offline sessions cleared');
    } catch (error) {
      console.error('Error clearing all sessions:', error);
    }
  }

  private getSessionsList(): string[] {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_PREFIX}sessions_index`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting sessions list:', error);
      return [];
    }
  }

  getStorageStats(): { sessionCount: number; totalSize: string } {
    try {
      const sessions = this.getSessionsList();
      let totalSize = 0;

      // Calculate total storage size
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX) || key.startsWith('movements-') || key.startsWith('session-')) {
          totalSize += localStorage.getItem(key)?.length || 0;
        }
      });

      return {
        sessionCount: sessions.length,
        totalSize: (totalSize / 1024).toFixed(2) + ' KB'
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { sessionCount: 0, totalSize: '0 KB' };
    }
  }
}

export const offlineSessionService = new OfflineSessionService();
