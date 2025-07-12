import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Brain, Volume2, Music, Mic, Zap, Star, Hash } from 'lucide-react';

interface GeminiAnalysis {
  success: boolean;
  tags: string[];
  description: string;
  transcription: string;
  genre_confidence: number;
  has_vocals: boolean;
  energy_level: number;
  instruments_detected: string[];
  error?: string;
}

interface TagsDisplayProps {
  geminiAnalysis: GeminiAnalysis | null;
  className?: string;
  compact?: boolean;
}

const TagsDisplay: React.FC<TagsDisplayProps> = ({ 
  geminiAnalysis, 
  className = '', 
  compact = false 
}) => {
  if (!geminiAnalysis || !geminiAnalysis.success) {
    return null;
  }

  const getTagColor = (tag: string) => {
    const tagColors: { [key: string]: string } = {
      // Genres
      'hip-hop': '#FF6B6B', 'rap': '#FF6B6B', 'jazz': '#4ECDC4', 'blues': '#45B7D1',
      'rock': '#F7DC6F', 'pop': '#BB8FCE', 'electronic': '#52C41A', 'classical': '#FFA726',
      'country': '#8BC34A', 'folk': '#26A69A', 'reggae': '#FFD54F', 'metal': '#EF5350',
      
      // Moods
      'energetic': '#FF9800', 'uplifting': '#4CAF50', 'melancholic': '#9C27B0',
      'aggressive': '#F44336', 'calm': '#00BCD4', 'peaceful': '#81C784',
      'dark': '#424242', 'bright': '#FFEB3B', 'emotional': '#E91E63',
      
      // Instruments
      'guitar': '#FF7043', 'piano': '#7986CB', 'drums': '#FFA726', 'bass': '#26A69A',
      'synthesizer': '#AB47BC', 'violin': '#5C6BC0', 'saxophone': '#FFB74D',
      'vocals': '#EC407A', 'strings': '#8D6E63', 'brass': '#FFD54F',
      
      // Production
      'lo-fi': '#A1887F', 'polished': '#42A5F5', 'raw': '#8D6E63', 'ambient': '#80CBC4',
      'reverb': '#9FA8DA', 'distorted': '#FF8A65', 'clean': '#A5D6A7',
      
      // Tempo
      'fast-paced': '#FF5722', 'slow-tempo': '#607D8B', 'mid-tempo': '#FFC107',
      'rhythmic': '#E57373', 'melodic': '#81C784', 'harmonic': '#64B5F6'
    };
    
    // Find exact match or partial match
    const exactMatch = tagColors[tag.toLowerCase()];
    if (exactMatch) return exactMatch;
    
    // Check for partial matches
    for (const [key, color] of Object.entries(tagColors)) {
      if (tag.toLowerCase().includes(key) || key.includes(tag.toLowerCase())) {
        return color;
      }
    }
    
    // Default color based on tag hash
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#52C41A', '#FFA726'];
    const hash = tag.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getEnergyColor = (level: number) => {
    if (level <= 3) return '#4CAF50'; // Green for low energy
    if (level <= 6) return '#FF9800'; // Orange for medium energy
    return '#F44336'; // Red for high energy
  };

  const getEnergyLabel = (level: number) => {
    if (level <= 2) return 'Very Chill';
    if (level <= 4) return 'Relaxed';
    if (level <= 6) return 'Moderate';
    if (level <= 8) return 'Energetic';
    return 'High Energy';
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`bg-black/20 rounded-lg p-3 border border-white/10 ${className}`}
      >
        <div className="mb-2 text-yellow-300 font-bebas text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-yellow-400" strokeWidth={2.2} />
          AI INSIGHTS
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {geminiAnalysis.tags.slice(0, 6).map((tag, index) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="px-2 py-1 rounded-full text-xs font-medium text-white border border-white/20"
              style={{ 
                backgroundColor: `${getTagColor(tag)}20`,
                borderColor: `${getTagColor(tag)}40`,
                color: getTagColor(tag)
              }}
            >
              {tag}
            </motion.span>
          ))}
          {geminiAnalysis.tags.length > 6 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium text-white/60 border border-white/20">
              +{geminiAnalysis.tags.length - 6} more
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-black/20 rounded-xl p-4 border border-white/10 ${className}`}
    >
      <div className="mb-4 text-yellow-300 font-bebas text-lg flex items-center gap-2">
        <Brain className="w-5 h-5 text-yellow-400" strokeWidth={2.2} />
        AI AUDIO UNDERSTANDING
      </div>

      {/* Description */}
      {geminiAnalysis.description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <span className="text-sm font-semibold text-white">Description</span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            {geminiAnalysis.description}
          </p>
        </motion.div>
      )}

      {/* Tags */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-green-400" strokeWidth={2} />
          <span className="text-sm font-semibold text-white">Tags</span>
          <span className="text-xs text-white/50">({geminiAnalysis.tags.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {geminiAnalysis.tags.map((tag, index) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="px-3 py-1 rounded-full text-sm font-medium text-white border border-white/20 hover:scale-105 transition-transform cursor-default"
                style={{ 
                  backgroundColor: `${getTagColor(tag)}20`,
                  borderColor: `${getTagColor(tag)}40`,
                  color: getTagColor(tag)
                }}
              >
                <Hash className="w-3 h-3 inline mr-1" strokeWidth={2} />
                {tag}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Energy Level */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="p-3 bg-white/5 rounded-lg border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4" style={{ color: getEnergyColor(geminiAnalysis.energy_level) }} strokeWidth={2} />
            <span className="text-sm font-semibold text-white">Energy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/10 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(geminiAnalysis.energy_level / 10) * 100}%`,
                  backgroundColor: getEnergyColor(geminiAnalysis.energy_level)
                }}
              />
            </div>
            <span className="text-xs text-white/70">
              {geminiAnalysis.energy_level}/10
            </span>
          </div>
          <span className="text-xs text-white/50">
            {getEnergyLabel(geminiAnalysis.energy_level)}
          </span>
        </motion.div>

        {/* Vocals */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="p-3 bg-white/5 rounded-lg border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-4 h-4 text-pink-400" strokeWidth={2} />
            <span className="text-sm font-semibold text-white">Vocals</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${geminiAnalysis.has_vocals ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-white/80">
              {geminiAnalysis.has_vocals ? 'Present' : 'Instrumental'}
            </span>
          </div>
          <span className="text-xs text-white/50">
            {Math.round(geminiAnalysis.genre_confidence * 100)}% confidence
          </span>
        </motion.div>
      </div>

      {/* Instruments */}
      {geminiAnalysis.instruments_detected.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <span className="text-sm font-semibold text-white">Instruments Detected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {geminiAnalysis.instruments_detected.map((instrument, index) => (
              <motion.span
                key={instrument}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="px-2 py-1 rounded text-xs font-medium text-white bg-purple-500/20 border border-purple-500/40"
              >
                {instrument}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transcription */}
      {geminiAnalysis.transcription && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="p-3 bg-white/5 rounded-lg border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-400" strokeWidth={2} />
            <span className="text-sm font-semibold text-white">Transcription</span>
          </div>
          <p className="text-sm text-white/80 italic leading-relaxed">
            "{geminiAnalysis.transcription}"
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default TagsDisplay; 