import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Globe, Shield, User, ThumbsUp, BookOpen, ExternalLink } from 'lucide-react';
import { Button, Card, Badge, ConfirmationModal } from './UI';

import { LoreEntry } from '../types';

interface PlanetDetailProps {
  planetName: string;
  lore: LoreEntry[];
  onBack: () => void;
  onLoreClick: (entry: LoreEntry) => void;
}

const PLANET_ASSETS: Record<string, string> = {
  'eyeke': '/assets/iPS42_Eyeke.png',
  'kavian': '/assets/iPS42_Kavian.png',
  'magor': '/assets/iPS42_Magor.png',
  'neri': '/assets/iPS42_Neri.png',
  'veles': '/assets/iPS42_Veles.png',
  'naron': '/assets/iPS42_Naron.png',
};

export const PlanetDetail: React.FC<PlanetDetailProps> = ({ planetName, lore, onBack, onLoreClick }) => {
  const planetImage = PLANET_ASSETS[planetName.toLowerCase()] || PLANET_ASSETS['eyeke'];
  
  const relatedLore = lore.filter(entry => 
    entry.title.toLowerCase().includes(planetName.toLowerCase()) ||
    entry.content.toLowerCase().includes(planetName.toLowerCase()) ||
    entry.entities?.some(e => e.name.toLowerCase() === planetName.toLowerCase())
  );

  const canonLore = relatedLore.filter(l => l.type === 'canon');
  const proposedLore = relatedLore.filter(l => l.type === 'proposed');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto space-y-8 pb-20"
    >
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="ghost" className="gap-2 text-neutral-grey hover:text-gold-default">
          <ChevronLeft size={16} /> Back to Atlas
        </Button>
        <div className="text-right">
          <p className="text-[10px] text-neutral-grey uppercase tracking-[0.2em]">Sector Analysis</p>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic text-gold-default terminal-text-glow">{planetName}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Planet Visual & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="relative overflow-hidden group border-gold-default/20">
            <div className="absolute inset-0 bg-gold-default/5 animate-pulse" />
            <div className="relative z-10 p-8 flex flex-col items-center">
              <div className="w-48 h-48 relative mb-6">
                <div className="absolute inset-0 bg-gold-default/20 rounded-full blur-2xl animate-pulse" />
                <img 
                  src={planetImage} 
                  alt={planetName} 
                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_50px_rgba(251,191,36,0.3)] animate-float"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="w-full space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-grey/10 pb-2">
                  <span className="text-[10px] uppercase text-neutral-grey">Classification</span>
                  <span className="text-xs font-bold text-neutral-white uppercase">Planetary Entity</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-grey/10 pb-2">
                  <span className="text-[10px] uppercase text-neutral-grey">Lore Entries</span>
                  <span className="text-xs font-bold text-neutral-white">{relatedLore.length}</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-grey/10 pb-2">
                  <span className="text-[10px] uppercase text-neutral-grey">Canon Status</span>
                  <Badge color="gold">{canonLore.length} Verified</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Planetary Coordinates" className="bg-neutral-black/40">
            <div className="space-y-2 font-mono text-[10px] text-neutral-grey">
              <div className="flex justify-between">
                <span>RA:</span>
                <span className="text-gold-default">14h 29m 42s</span>
              </div>
              <div className="flex justify-between">
                <span>DEC:</span>
                <span className="text-gold-default">-62° 40' 46"</span>
              </div>
              <div className="flex justify-between">
                <span>DIST:</span>
                <span className="text-gold-default">4.37 LY</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Lore Aggregation */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h3 className="text-xl font-bold uppercase italic text-neutral-white mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-gold-default" />
              Verified Canon Lore
            </h3>
            {canonLore.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {canonLore.map(entry => (
                  <Card 
                    key={entry.id} 
                    className="hover:border-gold-default/40 cursor-pointer transition-all group"
                    onClick={() => onLoreClick(entry)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold uppercase italic text-sm group-hover:text-gold-default transition-colors">{entry.title}</h4>
                      <Badge color="white">Canon</Badge>
                    </div>
                    <p className="text-[10px] text-neutral-grey line-clamp-2 mb-4">{entry.content.replace(/[#*`]/g, '')}</p>
                    <div className="flex items-center justify-between text-[8px] uppercase tracking-widest text-neutral-grey/60">
                      <span className="flex items-center gap-1"><User size={8} /> {entry.authorName}</span>
                      <span className="flex items-center gap-1"><ThumbsUp size={8} /> {entry.voteCount}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-neutral-grey/20 rounded-lg">
                <p className="text-xs text-neutral-grey uppercase tracking-widest">No verified canon lore found for this sector.</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold uppercase italic text-neutral-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-blue-default" />
              Proposed Transmissions
            </h3>
            {proposedLore.length > 0 ? (
              <div className="space-y-4">
                {proposedLore.map(entry => (
                  <Card 
                    key={entry.id} 
                    className="hover:border-blue-default/40 cursor-pointer transition-all group flex gap-4 items-center p-4"
                    onClick={() => onLoreClick(entry)}
                  >
                    <div className="w-10 h-10 bg-blue-default/5 border border-blue-default/20 flex items-center justify-center rounded flex-shrink-0">
                      <ExternalLink size={16} className="text-blue-default" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold uppercase italic text-xs truncate group-hover:text-blue-default transition-colors">{entry.title}</h4>
                        <Badge color="blue">{entry.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[8px] uppercase tracking-widest text-neutral-grey/60">
                        <span className="flex items-center gap-1"><User size={8} /> {entry.authorName}</span>
                        <span className="flex items-center gap-1"><ThumbsUp size={8} /> {entry.voteCount}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-neutral-grey/20 rounded-lg">
                <p className="text-xs text-neutral-grey uppercase tracking-widest">No active proposals for this sector.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
