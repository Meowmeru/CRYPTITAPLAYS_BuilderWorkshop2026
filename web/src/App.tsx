import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import CardPhotoExport from './components/CardPhotoExport';
import Footer from './components/Footer';
import Header from './components/Header';
import ProfileCard from './components/ProfileCard';
import SocialActions from './components/SocialActions';
import { usePortfolio } from './hooks/usePortfolio';

const CARD_WIDTH = 1020;
const CARD_ASPECT = 1.56;
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT;
const CARD_SIZE_SCALE = 0.97;
const STAGE_GAP = 28;
const STAGE_HORIZONTAL_PADDING = 12;
const STACK_GAP = 20;
const SOCIAL_ACTIONS_HEIGHT = 44;
const FALLBACK_STACK_HEIGHT = CARD_HEIGHT + STACK_GAP + SOCIAL_ACTIONS_HEIGHT;

type StageInsets = {
  top: number;
  bottom: number;
};

function useCardLayout(
  stageRef: RefObject<HTMLElement | null>,
  stackRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
) {
  const [scale, setScale] = useState(1);
  const [stackWidth, setStackWidth] = useState(CARD_WIDTH);
  const [stackHeight, setStackHeight] = useState(FALLBACK_STACK_HEIGHT);
  const [stageInsets, setStageInsets] = useState<StageInsets>({ top: 56, bottom: 56 });

  useEffect(() => {
    const updateLayout = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 56;
      const footerHeight = footerRef.current?.offsetHeight ?? 56;
      setStageInsets({ top: headerHeight, bottom: footerHeight });

      const stage = stageRef.current;
      if (!stage) return;

      const measuredStackHeight = stackRef.current?.offsetHeight ?? FALLBACK_STACK_HEIGHT;
      setStackHeight(measuredStackHeight);
      const measuredStackWidth = stackRef.current?.offsetWidth ?? CARD_WIDTH;
      setStackWidth(measuredStackWidth);

      const availableWidth = stage.clientWidth - STAGE_HORIZONTAL_PADDING * 2;
      const availableHeight = stage.clientHeight - STAGE_GAP * 2;
      const fitScale = Math.min(
        1,
        availableWidth / measuredStackWidth,
        availableHeight / measuredStackHeight,
      );
      const viewportScale = window.visualViewport?.scale ?? 1;
      setScale((fitScale / viewportScale) * CARD_SIZE_SCALE);
    };

    updateLayout();

    const observed = [stageRef.current, stackRef.current, headerRef.current, footerRef.current].filter(Boolean);
    const ro = new ResizeObserver(updateLayout);
    for (const node of observed) {
      if (node) ro.observe(node);
    }

    window.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('scroll', updateLayout);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('scroll', updateLayout);
    };
  }, [stageRef, stackRef, headerRef, footerRef]);

  return { scale, stackWidth, stackHeight, stageInsets };
}

export default function App() {
  const portfolio = usePortfolio();
  const stageRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const { scale, stackWidth, stackHeight, stageInsets } = useCardLayout(stageRef, stackRef, headerRef, footerRef);
  const [isOrbiting, setIsOrbiting] = useState(false);

  const moveBackground = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--bg-offset-x', `${16 * (1 - 2 * (event.clientX - rect.left) / rect.width)}px`);
    event.currentTarget.style.setProperty('--bg-offset-y', `${16 * (1 - 2 * (event.clientY - rect.top) / rect.height)}px`);
  };

  const resetBackground = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--bg-offset-x', '0px');
    event.currentTarget.style.setProperty('--bg-offset-y', '0px');
  };

  useEffect(() => {
    if (portfolio.status === 'success' && portfolio.data?.fields.builder_name) {
      document.title = `${portfolio.data.fields.builder_name} · Cryptita Plays`;
      return;
    }
    document.title = 'Cryptita Plays — Builder Workshop';
  }, [portfolio.data?.fields.builder_name, portfolio.status]);

  return (
    <div className="app-root" onPointerMove={moveBackground} onPointerLeave={resetBackground}>
      <div className="app-bg" aria-hidden="true" />
      <Header ref={headerRef} />
      <main
        className="card-stage"
        ref={stageRef}
        style={{
          top: stageInsets.top,
          bottom: stageInsets.bottom,
          padding: `${STAGE_GAP}px 12px`,
        }}
      >
        <CardPhotoExport portfolio={portfolio}>
          {({ onGifClick, onCameraClick, isGenerating, isCapturingPhoto, canExport, exportProgress, onCancelExport }) => (
            <div
              className="card-stage__scale-box"
              style={{
                width: stackWidth * scale,
                height: stackHeight * scale,
              }}
            >
              <div
                ref={stackRef}
                className="card-stage__stack"
                style={{
                  transform: `scale(${scale})`,
                }}
              >
                <div className="card-scale">
                  <ProfileCard portfolio={portfolio} isOrbiting={isOrbiting} />
                </div>
                <SocialActions
                  onGifClick={onGifClick}
                  onCameraClick={onCameraClick}
                  isGenerating={isGenerating}
                  isCapturingPhoto={isCapturingPhoto}
                  canExport={canExport}
                  exportProgress={exportProgress}
                  onCancelExport={onCancelExport}
                  isOrbiting={isOrbiting}
                  onOrbitClick={() => setIsOrbiting((current) => !current)}
                />
              </div>
            </div>
          )}
        </CardPhotoExport>
      </main>
      <Footer ref={footerRef} />
    </div>
  );
}
