import { useId } from 'react';
import type { CSSProperties } from 'react';
import { MatchFixture, TeamIdentity } from '../teams';

const SHIRT_PATH = 'M11 3 L5 5 1 11 6 15 9 12 9 31 23 31 23 12 26 15 31 11 27 5 21 3 19 7 13 7 Z';

export function KitIcon({ team, goalkeeper = false, size = 32 }: { team: TeamIdentity; goalkeeper?: boolean; size?: number }) {
  const clipId = `shirt-${useId().replace(/:/g, '')}`;
  const kit = goalkeeper ? team.goalkeeperKit : team.kit;
  const pattern = goalkeeper ? 'solid' : kit.pattern;
  return (
    <svg className="kit-icon" width={size} height={size * 1.06} viewBox="0 0 32 34" aria-hidden="true">
      <defs><clipPath id={clipId}><path d={SHIRT_PATH} /></clipPath></defs>
      <path d={SHIRT_PATH} fill={kit.primary} />
      <g clipPath={`url(#${clipId})`} fill={kit.secondary}>
        {pattern === 'stripes' && <><rect x="10" y="5" width="3" height="27" /><rect x="19" y="5" width="3" height="27" /><rect x="27" y="5" width="3" height="16" /></>}
        {pattern === 'hoops' && <><rect x="3" y="11" width="27" height="3" /><rect x="5" y="20" width="23" height="3" /><rect x="7" y="28" width="19" height="2" /></>}
        {pattern === 'sash' && <path d="M-3 25 L4 34 36 3 28 -5 Z" />}
        {pattern === 'halves' && <rect x="16" y="4" width="17" height="29" />}
        {pattern === 'band' && <rect x="5" y="14" width="23" height="5" />}
      </g>
      <path d={SHIRT_PATH} fill="none" stroke="rgba(4,10,16,.55)" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M13 7 L16 10 19 7" fill="none" stroke={kit.secondary} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Matchup({ fixture, scoreLine, compact = false }: { fixture: MatchFixture; scoreLine?: string; compact?: boolean }) {
  return (
    <div className={`matchup ${compact ? 'matchup--compact' : ''}`} style={{ '--match-home': fixture.home.kit.primary, '--match-away': fixture.away.kit.primary } as CSSProperties} aria-label={`${fixture.home.name} contra ${fixture.away.name}${scoreLine ? `, marcador ${scoreLine}` : ''}`}>
      <div className="matchup__team">
        <KitIcon team={fixture.home} size={compact ? 24 : 39} />
        <span><b>{compact ? fixture.home.shortName : fixture.home.name}</b><small>LOCAL</small></span>
      </div>
      <strong className="matchup__versus">{scoreLine ?? 'VS'}</strong>
      <div className="matchup__team matchup__team--away">
        <span><b>{compact ? fixture.away.shortName : fixture.away.name}</b><small>VISITANTE</small></span>
        <KitIcon team={fixture.away} size={compact ? 24 : 39} />
      </div>
    </div>
  );
}
