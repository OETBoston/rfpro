import React, { useEffect, useRef, useState } from 'react';
import { Button, Box, SpaceBetween, TextContent, Icon } from '@cloudscape-design/components';
import { WalkthroughState } from '../../common/types';
import {
  getElementPosition,
  calculateModalPosition,
  ElementPosition,
  ModalPosition
} from '../../common/helpers/walkthrough-utils';

type ModalPositionType = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'screen-center';
import styles from './walkthrough.module.scss';

interface WalkthroughModalProps {
  walkthroughState: WalkthroughState;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function WalkthroughModal({
  walkthroughState,
  onNext,
  onPrevious,
  onSkip,
  onClose
}: WalkthroughModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition>({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState<ElementPosition | null>(null);

  const currentStep = walkthroughState.config?.steps?.[walkthroughState.currentStepIndex];

  // Calculate modal and highlight positions
  useEffect(() => {
    if (!currentStep || !walkthroughState.isActive) return;

    const updatePositions = () => {
      let targetPosition: ElementPosition | null = null;

      // Get target element position if specified
      if (currentStep.targetSelector) {
        targetPosition = getElementPosition(currentStep.targetSelector);
        if (targetPosition) {
          setHighlightPosition(targetPosition);
        }
      } else {
        setHighlightPosition(null);
      }

      // Calculate modal position
      const preferredPosition = (currentStep.position || 'center') as ModalPositionType;
      // Adjust modal size based on target type
      const isButton = targetPosition && (
        currentStep.targetSelector?.includes('sources-button') ||
        currentStep.targetSelector?.includes('copy-button-container') ||
        currentStep.targetSelector?.includes('feedback-buttons')
      );
      const modalWidth = 400;
      const modalHeight = isButton ? 250 : 350; // Smaller height for button targets

      let calculatedPosition: ModalPosition;

      if (preferredPosition === 'screen-center') {
        // Absolute center of screen, ignoring target
        calculatedPosition = {
          top: Math.max(20, (window.innerHeight - modalHeight) / 2),
          left: Math.max(20, (window.innerWidth - modalWidth) / 2),
        };
      } else if (targetPosition && preferredPosition !== 'center') {
        calculatedPosition = calculateModalPosition(
          targetPosition,
          preferredPosition,
          modalWidth,
          modalHeight
        );
      } else {
        // Default center position relative to target if exists
        calculatedPosition = targetPosition ? {
          top: Math.max(20, targetPosition.top - modalHeight - 20),
          left: Math.max(20, targetPosition.left + (targetPosition.width - modalWidth) / 2),
        } : {
          top: Math.max(20, (window.innerHeight - modalHeight) / 2),
          left: Math.max(20, (window.innerWidth - modalWidth) / 2),
        };
      }

      setModalPosition(calculatedPosition);
    };

    // Initial position update
    updatePositions();

    // Create a more aggressive update function that runs in an animation frame
    let animationFrameId: number;
    const updatePositionsInFrame = () => {
      updatePositions();
      animationFrameId = requestAnimationFrame(updatePositionsInFrame);
    };

    // Start continuous updates
    updatePositionsInFrame();

    // Also handle discrete events
    const handleResize = () => updatePositions();
    const handleScroll = () => updatePositions();
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true); // Capture phase to catch all scroll events

    // Update positions when target element changes size
    let resizeObserver: ResizeObserver | null = null;
    if (currentStep.targetSelector) {
      const targetElement = document.querySelector(currentStep.targetSelector);
      if (targetElement) {
        resizeObserver = new ResizeObserver(updatePositions);
        resizeObserver.observe(targetElement);
      }
    }

    // Cleanup function
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [currentStep, walkthroughState.isActive, walkthroughState.currentStepIndex]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is active
  useEffect(() => {
    if (walkthroughState.isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [walkthroughState.isActive]);

  if (!walkthroughState.isActive || !currentStep) {
    return null;
  }

  const canGoPrevious = walkthroughState.currentStepIndex > 0 && 
    !walkthroughState.config?.steps?.[walkthroughState.currentStepIndex - 1]?.condition;
  const canGoNext = walkthroughState.currentStepIndex < (walkthroughState.config?.steps.length || 0) - 1;
  const isLastStep = walkthroughState.currentStepIndex === (walkthroughState.config?.steps.length || 0) - 1;

  return (
    <>
      {/* Background Mask with clip-path hole */}
      <div 
        className={styles.walkthrough_mask}
        data-has-target={!!highlightPosition}
        style={highlightPosition ? {
          clipPath: `polygon(
            0 0,
            0 100%,
            100% 100%,
            100% 0,
            100% ${highlightPosition.top - 4}px,
            ${highlightPosition.left + highlightPosition.width + 4}px ${highlightPosition.top - 4}px,
            ${highlightPosition.left + highlightPosition.width + 4}px ${highlightPosition.top + highlightPosition.height + 4}px,
            ${highlightPosition.left - 4}px ${highlightPosition.top + highlightPosition.height + 4}px,
            ${highlightPosition.left - 4}px ${highlightPosition.top - 4}px,
            100% ${highlightPosition.top - 4}px,
            100% 0
          )`,
          position: 'fixed',
          top: 0,
          left: 0
        } : undefined}
      />
      {/* Highlight border */}
      {highlightPosition && (
        <div
          className={styles.walkthrough_highlight}
          style={{
            position: 'fixed',
            top: highlightPosition.top - 4,
            left: highlightPosition.left - 4,
            width: highlightPosition.width + 8,
            height: highlightPosition.height + 8,
          }}
        />
      )}

      {/* Modal */}
      <div
        ref={modalRef}
        className={styles.walkthrough_modal}
        style={{
          top: modalPosition.top,
          left: modalPosition.left,
        }}
      >
        <div className={styles.walkthrough_content}>
          <button 
            className={styles.walkthrough_close}
            onClick={onClose}
            aria-label="Close walkthrough"
          >
            <Icon name="close" size="normal" />
          </button>
          <SpaceBetween direction="vertical" size="m">
            {/* Header */}
            <Box>
              <TextContent>
                <h2 className={styles.walkthrough_title}>
                  {currentStep.title}
                </h2>
                <p className={styles.walkthrough_text}>
                  {currentStep.text}
                </p>
                {currentStep.hint && (
                  <p className={styles.walkthrough_hint}>
                    <em>{currentStep.hint}</em>
                  </p>
                )}
              </TextContent>
            </Box>

            {/* Navigation buttons */}
            <Box float="right">
              <SpaceBetween direction="horizontal" size="s">
                {canGoPrevious && (
                  <Button onClick={onPrevious} variant="link">
                    Previous
                  </Button>
                )}

                {walkthroughState.currentStepIndex === 0 && (
                  <Button onClick={onClose} variant="link">
                    Skip Tutorial
                  </Button>
                )}

                {isLastStep ? (
                  <Button onClick={onClose} variant="primary">
                    Finish
                  </Button>
                ) : !currentStep.condition ? (
                  <Button
                    onClick={onNext}
                    variant="primary"
                    disabled={!canGoNext}
                  >
                    {walkthroughState.currentStepIndex === 0 
                      ? walkthroughState.config?.firstStepButtonText 
                      : isLastStep 
                        ? walkthroughState.config?.lastStepButtonText 
                        : walkthroughState.config?.intermediateStepButtonText}
                  </Button>
                ) : null}
              </SpaceBetween>
            </Box>
          </SpaceBetween>
        </div>
      </div>
    </>
  );
}
