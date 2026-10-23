import { Crown, Flame, Globe2, Sparkles, Star, Trophy, Video, Zap } from 'lucide-react';

export function LevelIcon({ levelId, size = 18 }: { levelId: string; size?: number }) {
  const props = { size, strokeWidth: 1.9, 'aria-hidden': true as const };
  switch (levelId) {
    case 'career-regional': return <Trophy {...props} />;
    case 'career-national': return <Star {...props} />;
    case 'career-international': return <Globe2 {...props} />;
    case 'career-final': return <Crown {...props} />;
    case 'arcade-rush': return <Zap {...props} />;
    case 'arcade-chaos': return <Sparkles {...props} />;
    case 'arcade-legend': return <Flame {...props} />;
    default: return <Video {...props} />;
  }
}
