import React from 'react';
import WalkthroughModal from './walkthrough-modal';
import { useWalkthrough } from '../../common/hooks/use-walkthrough';

interface WalkthroughProps {
  configId: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function Walkthrough({
  configId,
  onComplete,
  onSkip
}: WalkthroughProps) {
  const {
    walkthroughState,
    startWalkthrough,
    nextStep,
    previousStep,
    skipWalkthrough,
    isLoading
  } = useWalkthrough();

  const handleStart = async () => {
    await startWalkthrough(configId);
  };

  const handleNext = () => {
    nextStep();
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleSkip = () => {
    skipWalkthrough();
    onSkip?.();
  };

  const handleClose = () => {
    skipWalkthrough();
    onComplete?.();
  };

  // Expose the start function for external use
  React.useEffect(() => {
    (window as any).__walkthroughStart = handleStart;
    return () => {
      delete (window as any).__walkthroughStart;
    };
  }, [handleStart]);

  return (
    <>
      <WalkthroughModal
        walkthroughState={walkthroughState}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        onClose={handleClose}
      />
    </>
  );
}
