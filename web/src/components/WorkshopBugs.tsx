import { useState, type CSSProperties, type PointerEvent } from 'react';
import '../styles/workshop-bugs.css';

type Bug = {
  id: number;
  left: number;
  top: number;
  heading: number;
  x: number;
  y: number;
  frozenTranslate?: string;
  dead: boolean;
};

type WorkshopBugsProps = {
  isFlipped: boolean;
  motionLocked: boolean;
};

const initialBugs: Bug[] = [
  { id: 0, left: 20, top: 79, heading: -24, x: 0, y: 0, dead: false },
  { id: 1, left: 78, top: 61, heading: 35, x: 0, y: 0, dead: false },
  { id: 2, left: 37, top: 9, heading: -65, x: 0, y: 0, dead: false },
];

function replacementBug(id: number): Bug {
  return {
    id,
    left: 15 + ((id * 37) % 65),
    top: 12 + ((id * 47) % 66),
    heading: ((id * 53) % 120) - 60,
    x: 0,
    y: 0,
    dead: false,
  };
}

function Insect() {
  return (
    <svg className="workshop-bugs__insect" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <g fill="none" stroke="#18222b" strokeWidth="3" strokeLinecap="round">
        <path d="M26 28 14 21M25 35 11 35M27 42 16 51M38 28 50 21M39 35 53 35M37 42 48 51" />
        <path d="M28 18 24 10M36 18 40 10" />
      </g>
      <g className="workshop-bugs__wings" fill="#d8f6ff" fillOpacity=".85" stroke="#8cc3d0" strokeWidth="1.5">
        <ellipse cx="23" cy="31" rx="10" ry="16" transform="rotate(-32 23 31)" />
        <ellipse cx="41" cy="31" rx="10" ry="16" transform="rotate(32 41 31)" />
      </g>
      <g className="workshop-bugs__body">
        <ellipse cx="32" cy="37" rx="9" ry="15" fill="#24333d" />
        <path d="M25 35h14M26 42h12" stroke="#f4bf50" strokeWidth="4" />
        <circle cx="32" cy="22" r="8" fill="#24333d" />
        <g className="workshop-bugs__eyes">
          <circle cx="28" cy="21" r="2.5" fill="#effcff" />
          <circle cx="36" cy="21" r="2.5" fill="#effcff" />
        </g>
      </g>
    </svg>
  );
}

// Challenge 1: removing this component from ProfileCard evicts the bugs.
export function WorkshopBugs({ isFlipped, motionLocked }: WorkshopBugsProps) {
  const [bugs, setBugs] = useState(initialBugs);

  const dodge = (id: number, back: boolean, event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = bounds.left + bounds.width / 2 - event.clientX;
    const dy = bounds.top + bounds.height / 2 - event.clientY;
    const distance = Math.hypot(dx, dy) || 1;
    setBugs((current) => current.map((bug) => (
      bug.id === id && !bug.dead
        ? {
            ...bug,
            x: Math.max(-48, Math.min(48, bug.x + (dx / distance) * (back ? -18 : 18))),
            y: Math.max(-48, Math.min(48, bug.y + (dy / distance) * 18)),
          }
        : bug
    )));
  };

  const squash = (id: number, frozenTranslate: string) => {
    setBugs((current) => {
      if (!current.some((bug) => bug.id === id && !bug.dead)) return current;
      return [
        ...current.map((bug) => (bug.id === id ? { ...bug, dead: true, frozenTranslate } : bug)),
        replacementBug(current.length),
      ];
    });
  };

  return ([false, true] as const).map((back) => (
    <div
      key={String(back)}
      className={`workshop-bugs${back ? ' workshop-bugs--back' : ''}${motionLocked ? ' is-scattered' : ''}`}
      aria-hidden={isFlipped !== back}
    >
      {bugs.map((bug) => (
        <span
          className={`workshop-bugs__flight${bug.id > 2 ? ' is-replacement' : ''}${bug.dead ? ' is-dead' : ''}`}
          key={bug.id}
          style={{
            left: `${bug.left}%`,
            top: `${bug.top}%`,
            translate: bug.dead ? bug.frozenTranslate : `${bug.x}px ${bug.y}px`,
            '--heading': `${bug.heading}deg`,
            '--arrival-delay': bug.id < 3 ? `${2.4 + bug.id * 0.5}s` : '0s',
            '--arrival-x': bug.left < 50 ? '-580px' : '580px',
            '--fly-x': bug.left < 50 ? '-240px' : '260px',
          } as CSSProperties}
        >
          {bug.dead ? (
            <Insect />
          ) : (
            <button
              className="workshop-bugs__target"
              type="button"
              tabIndex={isFlipped === back && !motionLocked ? 0 : -1}
              disabled={motionLocked}
              aria-label={`Squash bug ${bug.id + 1}`}
              onPointerEnter={(event) => dodge(bug.id, back, event)}
              onClick={(event) => {
                event.stopPropagation();
                squash(bug.id, getComputedStyle(event.currentTarget.parentElement!).translate);
              }}
            >
              <Insect />
            </button>
          )}
        </span>
      ))}
    </div>
  ));
}
