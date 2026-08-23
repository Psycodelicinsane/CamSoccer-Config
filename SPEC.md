# CamSoccer - TV Broadcast Director Game

## Concept & Vision

You're the TV director for a football match. Your job isn't to play — it's to capture the drama as it unfolds. The audience is watching YOUR broadcast, and they'll flip channels if you bore them. Chase the action: zoom on strikers bearing down on goal, track angry coaches, and SNAP to rare events like streakers, pitch invasions, and dog appearances before they vanish. The faster you catch the moment, the higher your audience spikes. It's a frantic, reflex-driven dance of anticipation and reaction wrapped in the visual language of live sports TV.

**Feel**: Heart-pounding, twitchy, satisfying. Like being behind the scenes at a major final, with肾上腺素 and deadlines.

## Design Language

### Aesthetic Direction
Vibrant sports broadcast aesthetic meets retro TV glitch art. Think 90s football coverage with CRT scan lines, chromatic aberration on big moments, and that warm glow of a TV studio control room. Neon accents pop against dark backgrounds.

### Color Palette
- **Primary (Action Green)**: `#00FF88` - highlights, active elements, GO!
- **Secondary (Stadium Gold)**: `#FFD700` - scores, achievements, big numbers
- **Accent (Alert Red)**: `#FF3366` - danger, low audience, events
- **Background Dark**: `#0D1117` - main bg, control room vibes
- **Background Mid**: `#161B22` - panels, cards
- **Text Primary**: `#FFFFFF`
- **Text Muted**: `#8B949E`
- **Camera Viewfinder**: `#00FFFF` (cyan) - viewfinder frame

### Typography
- **Primary**: 'Orbitron', sans-serif - futuristic sports HUD feel
- **Secondary**: 'Roboto Mono', monospace - scores, stats, technical readouts
- **Fallback**: system-ui, sans-serif

### Spatial System
- Base unit: 8px
- Border radius: 4px (sharp, technical)
- Camera viewfinder: thick 4px borders with corner brackets

### Motion Philosophy
- **Snappy transitions**: 100-150ms for UI responses
- **Screen shake**: 3-8px displacement on goals, events, mistakes
- **Particle bursts**: Confetti on high audience, sparks on mistakes
- **Pulse animations**: Audience meter pulses when critical
- **Viewfinder glide**: Smooth 200ms ease-out camera movements
- **Slow-motion**: 0.3x speed effect for replays with motion blur

### Visual Assets
- SVG icons for UI elements
- CSS-drawn football field with perspective
- Animated crowd silhouettes
- Particle system for effects (canvas-based)
- Scan line overlay for broadcast feel

## Layout & Structure

### Screen Flow
1. **START SCREEN** → Title, "START BROADCAST" button, high scores, how-to-play
2. **GAME SCREEN** → Main broadcast view, HUD overlay, controls
3. **PAUSE MODAL** → Overlay with resume/restart/quit options
4. **GAME OVER** → Final score, stats breakdown, new high score celebration, restart

### Game Screen Layout
```
┌─────────────────────────────────────┐
│ [AUDIENCE: ███████░░░ 67%] [SCORE]  │  ← Top HUD bar
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │      CAMERA VIEWFINDER      │    │
│  │       (main viewport)       │    │
│  │                             │    │
│  │    [Football field view     │    │
│  │     with players/events]    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│ [ZOOM] ◄─────────────────────────►  │  ← Touch/keyboard controls
│ [SLOW-MO: 3]  [ANGLE: 1/4]          │  ← Ability cooldowns
└─────────────────────────────────────┘
```

### Responsive Strategy
- Desktop: Full HUD, keyboard controls prominent
- Mobile: Touch joystick/drag for camera, larger buttons, simplified HUD

## Features & Interactions

### Core Gameplay Loop
1. Match starts with crowd establishing shots
2. Events spawn randomly across the field (players moving, coaches angry, etc.)
3. Player moves camera viewport to track interesting events
4. Events have a "window" - stay on them to satisfy audience
5. Rare events (streaker, dog, fight) appear briefly - SNAP to them!
6. Audience builds or drops based on your tracking accuracy
7. Match ends when time runs out or audience hits zero

### Event Types
| Event | Points | Duration | Audience Impact |
|-------|--------|----------|-----------------|
| Player with ball | 10 | 4s | +5% if tracked |
| Shot on goal | 25 | 2s | +15% if tracked |
| Goal scored | 100 | 5s | +30% |
| Angry coach | 15 | 3s | +8% if tracked |
| Near miss | 20 | 2s | +12% if tracked |
| **STREAKER** | 200 | 1.5s | +50% |
| **Dog on pitch** | 175 | 2s | +45% |
| **Fight in stands** | 150 | 2.5s | +40% |
| Boring moment | -5 | 3s | -10% if ignored |

### Camera Controls
- **Keyboard**: WASD or Arrow keys to pan, Q/E for zoom, SPACE for slow-mo
- **Touch**: Drag anywhere to pan, pinch to zoom, tap slow-mo button
- Camera movement is smooth with slight momentum

### Unlockable Equipment (Progression)
- **Level 1 (Local Match)**: Basic camera, 1x zoom, no slow-mo
- **Level 2**: +2x zoom, basic tracking reticle
- **Level 3**: Wide angle option, slow-mo (3 charges)
- **Level 4**: Auto-track assist (50% accuracy help)
- **Level 5 (Final)**: All features, 4K camera badge

### Difficulty Progression
- Local Match: 60s, slow events, 1 rare event
- Regional Cup: 90s, medium events, 2 rare events
- National League: 120s, fast events, 3 rare events
- International: 150s, chaotic, 4 rare events
- Champions Final: 180s, all features, 5 rare events

### Edge Cases
- If audience hits 0%: Broadcast ends early (Game Over)
- If event overlaps: Prioritize rare events
- Slow-mo charges: Regenerate 1 per 30s, max 5
- Touch outside bounds: Camera stops at field edges

## Component Inventory

### Audience Meter
- Horizontal bar, fills left-to-right
- Color gradient: Red (0-30%) → Yellow (30-60%) → Green (60-100%)
- Pulse animation when below 30%
- "+X%" popup on successful tracking
- Screen edge glow matches meter color

### Camera Viewfinder
- Thick cyan border with corner brackets
- "REC" indicator blinking red dot
- Current zoom level badge
- "LIVE" stamp when broadcasting
- Tracking reticle when locked onto event
- Shake effect on big moments

### Event Markers
- Floating icons above events (player silhouette, ball, etc.)
- Warning "!" indicator for rare events
- Glow intensity increases as event approaches
- Fade out when event expires

### Score Display
- Large numbers, top-right
- Combo multiplier for consecutive good captures
- "+POINTS" floating text animations

### Slow-Mo Button
- Circular button with clock icon
- Charges displayed as dots around perimeter
- Grayed out when depleted
- Flash effect when activated

### Pause Button
- Top corner, always visible
- Two vertical bars icon
- Subtle pulse to remind player it exists

### Event Feed (Right side)
- Scrolling log of recent captures
- Icons + short descriptions
- Green checkmark for good captures
- Red X for misses

## Technical Approach

### Architecture
- React 18 with TypeScript for UI management
- Canvas-based game rendering for 60fps performance
- requestAnimationFrame game loop
- State machine for game phases (menu, playing, paused, gameover)

### Performance Targets
- 60fps on desktop and mobile
- <16ms frame time budget
- Touch response <50ms
- Particle systems pooled and recycled

### Key Systems
1. **Event Spawner**: Random generation with weighted probabilities
2. **Camera Controller**: Smooth movement with bounds checking
3. **Audience Engine**: Real-time calculation based on tracking
4. **Particle System**: Object pool for effects
5. **Audio Manager**: Web Audio API for SFX (optional, muted by default)
6. **Score Persistence**: localStorage for high scores

### Data Model
```typescript
interface GameState {
  phase: 'menu' | 'playing' | 'paused' | 'gameover';
  audience: number; // 0-100
  score: number;
  combo: number;
  timeRemaining: number;
  camera: { x: number; y: number; zoom: number };
  unlockedLevel: number;
  slowMoCharges: number;
  events: Event[];
  recentCaptures: CaptureLog[];
}

interface Event {
  id: string;
  type: EventType;
  x: number; // field position 0-100
  y: number;
  startTime: number;
  duration: number;
  isRare: boolean;
  isActive: boolean;
}

interface HighScore {
  score: number;
  level: string;
  date: string;
}
```

### Controls Implementation
- Keyboard: keydown/keyup listeners with state tracking
- Touch: pointer events for cross-device compatibility
- Prevent default scroll/zoom on game area
- Visual control hints on first play
