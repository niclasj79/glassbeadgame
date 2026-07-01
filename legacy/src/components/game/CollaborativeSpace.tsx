
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GameState, Player } from '../GlassBeadGame';
import { Users, MessageCircle, Share, Crown } from 'lucide-react';

interface CollaborativeSpaceProps {
  gameState: GameState;
  onStateChange: (state: GameState) => void;
  disciplines: any[];
}

export const CollaborativeSpace: React.FC<CollaborativeSpaceProps> = ({
  gameState,
  onStateChange,
  disciplines
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  // Mock collaborative players for demonstration
  const mockPlayers: Player[] = [
    { id: 'player1', name: 'Alice', color: '#3B82F6', activeNodes: ['mathematics', 'music'] },
    { id: 'player2', name: 'Bob', color: '#10B981', activeNodes: ['philosophy', 'physics'] },
    { id: 'player3', name: 'Carol', color: '#8B5CF6', activeNodes: ['art', 'mathematics'] }
  ];

  useEffect(() => {
    // Simulate receiving messages from other players
    const mockMessages = [
      { id: 1, player: 'Alice', message: 'I see fascinating connections between harmonic ratios and group theory', timestamp: Date.now() - 60000 },
      { id: 2, player: 'Bob', message: 'The phenomenological aspects of consciousness might relate to quantum measurement', timestamp: Date.now() - 30000 },
      { id: 3, player: 'Carol', message: 'Visual proportions echo mathematical constants across cultures', timestamp: Date.now() - 10000 }
    ];
    setMessages(mockMessages);
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      player: 'You',
      message: newMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
  };

  const joinRoom = () => {
    if (roomCode.length === 6) {
      onStateChange({
        ...gameState,
        collaborators: mockPlayers
      });
    }
  };

  const getPlayerDisciplines = (player: Player) => {
    return player.activeNodes.map(nodeId => {
      const discipline = disciplines.find(d => d.id === nodeId);
      return discipline;
    }).filter(Boolean);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Room Management */}
      <div className="space-y-4">
        <Card className="bg-gray-800 border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Collaboration Room
          </h3>
          
          <div className="space-y-3">
            {!roomCode ? (
              <Button 
                onClick={createRoom} 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                Create Room
              </Button>
            ) : (
              <div className="text-center">
                <div className="flex items-center gap-2 mb-2">
                  {isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                  <Badge variant="outline" className="border-green-400 text-green-400">
                    Room: {roomCode}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(roomCode)}>
                  <Share className="w-4 h-4 mr-2" />
                  Share Code
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="bg-gray-700 border-gray-600 text-white"
                maxLength={6}
              />
              <Button onClick={joinRoom} disabled={roomCode.length !== 6}>
                Join
              </Button>
            </div>
          </div>
        </Card>

        {/* Active Players */}
        <Card className="bg-gray-800 border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Active Players</h3>
          <div className="space-y-3">
            {mockPlayers.map(player => (
              <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-700">
                <Avatar className="w-8 h-8">
                  <AvatarFallback style={{ backgroundColor: player.color }}>
                    {player.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-white">{player.name}</p>
                  <div className="flex gap-1 mt-1">
                    {getPlayerDisciplines(player).map(discipline => (
                      <Badge 
                        key={discipline?.id}
                        variant="secondary" 
                        className="text-xs"
                        style={{ backgroundColor: discipline?.color + '40' }}
                      >
                        {discipline?.icon}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Collaborative Canvas */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-gray-800 border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Shared Synthesis Space</h3>
          <div className="bg-gradient-to-br from-indigo-950 to-purple-950 rounded-lg p-6 h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {mockPlayers.map(player => (
                  <div key={player.id} className="text-center">
                    <div 
                      className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold animate-pulse"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name[0]}
                    </div>
                    <p className="text-xs text-gray-400">{player.name}</p>
                  </div>
                ))}
              </div>
              <p className="text-gray-400">
                Collaborative synthesis visualization would appear here
              </p>
            </div>
          </div>
        </Card>

        {/* Chat Interface */}
        <Card className="bg-gray-800 border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Discussion
          </h3>
          
          <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 mb-4">
            <div className="space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <div className="flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {msg.player}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{msg.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Share your insights..."
              className="bg-gray-700 border-gray-600 text-white"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim()}>
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
