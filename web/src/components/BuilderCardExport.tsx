import { forwardRef, useCallback, useRef } from 'react';
import { PROFILE_PHOTO_PATH } from '../lib/profilePhoto';
import type { UsePortfolioResult } from '../types';
import { CardBackFace, CardFrontFace } from './ProfileCardFaces';
import '../styles/profile-card.css';
import '../styles/card-photo-export.css';

type BuilderCardExportProps = {
  portfolio: UsePortfolioResult;
};

const BuilderCardExport = forwardRef<HTMLDivElement, BuilderCardExportProps>(
  function BuilderCardExport({ portfolio }, ref) {
    const { status } = portfolio;
    const showPhoto = status !== 'error';

    const rootRef = useRef<HTMLDivElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    return (
      <div
        ref={setRefs}
        className="builder-card-export"
        aria-hidden="true"
        data-export-root
      >
        <div className="builder-card-export__studio">
          <div className="builder-card-export__cards">
            <div className="builder-card-export__card-wrap builder-card-export__card-wrap--front">
              <div className="builder-card-export__card-shell">
                <CardFrontFace
                  portfolio={portfolio}
                  photoSrc={PROFILE_PHOTO_PATH}
                  showPhoto={showPhoto}
                  photoCrossOrigin
                />
              </div>
            </div>

            <div className="builder-card-export__card-wrap builder-card-export__card-wrap--back">
              <div className="builder-card-export__card-shell">
                <CardBackFace portfolio={portfolio} backFaceTabIndex={-1} backFaceAriaHidden />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default BuilderCardExport;
