import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, BookOpen, Brain } from 'lucide-react';

interface HeroSectionProps {
  onStartGame: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStartGame }) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background illustration */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-black">
        {/* Ethereal orbs and light effects */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-purple-400/30 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-40 left-40 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-32 right-20 w-28 h-28 bg-violet-400/25 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* Geometric patterns suggesting the Glass Bead Game */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="beadPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.3"/>
                <circle cx="5" cy="15" r="1.5" fill="currentColor" opacity="0.2"/>
                <circle cx="15" cy="5" r="1" fill="currentColor" opacity="0.4"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#beadPattern)" className="text-white"/>
          </svg>
        </div>
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/40 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-8 max-w-4xl">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-6xl md:text-8xl font-light text-white mb-4 tracking-wide">
            <span className="bg-gradient-to-r from-blue-200 via-purple-200 to-indigo-200 bg-clip-text text-transparent">
              The Glass
            </span>
          </h1>
          <h1 className="text-6xl md:text-8xl font-light text-white mb-6 tracking-wide">
            <span className="bg-gradient-to-r from-purple-200 via-indigo-200 to-blue-200 bg-clip-text text-transparent">
              Bead Game
            </span>
          </h1>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mx-auto mb-8"></div>
        </div>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-blue-100/80 mb-4 font-light leading-relaxed">
          Das Glasperlenspiel
        </p>
        <p className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
          An immersive synthesis of all human knowledge, where disciplines dance in harmony 
          and wisdom emerges from the connections between all things
        </p>

        {/* Philosophical quote */}
        <blockquote className="text-base md:text-lg text-indigo-200/80 italic mb-12 max-w-3xl mx-auto leading-relaxed">
          "The Game was thus a mode of playing with the total contents and values of our culture"
          <footer className="text-sm text-white/50 mt-2 not-italic">— Hermann Hesse</footer>
        </blockquote>

        {/* Call to action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            onClick={onStartGame}
            size="lg"
            className="bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 text-white border border-white/20 backdrop-blur-sm px-8 py-3 text-lg font-light tracking-wide transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="w-5 h-5 mr-3" />
            Start The Game
          </Button>
          
          <div className="flex items-center gap-6 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Explore Knowledge</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>Discover Connections</span>
            </div>
          </div>
        </div>

        {/* Floating elements for visual interest */}
        <div className="absolute -top-20 -left-20 w-1 h-1 bg-white/60 rounded-full animate-ping"></div>
        <div className="absolute -bottom-16 -right-16 w-1 h-1 bg-blue-300/60 rounded-full animate-ping delay-1000"></div>
        <div className="absolute top-10 right-10 w-1 h-1 bg-purple-300/60 rounded-full animate-ping delay-2000"></div>
      </div>
    </div>
  );
};
