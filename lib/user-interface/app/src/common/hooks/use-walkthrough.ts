import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WalkthroughConfig,
  WalkthroughState,
  WalkthroughStep,
  WalkthroughCondition
} from '../types';
import {
  loadWalkthroughConfig,
  getElementPosition,
  createHighlightHole,
  debounce
} from '../helpers/walkthrough-utils';
import { StorageHelper } from '../helpers/storage-helper';

export interface UseWalkthroughReturn {
  walkthroughState: WalkthroughState;
  startWalkthrough: (configId: string) => Promise<void>;
  nextStep: () => void;
  previousStep: () => void;
  skipWalkthrough: () => void;
  isLoading: boolean;
}

export function useWalkthrough(): UseWalkthroughReturn {
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState>({
    isActive: false,
    currentStepIndex: 0,
    config: null,
    highlightedElement: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const conditionCheckRef = useRef<NodeJS.Timeout>();
  const stateRef = useRef<WalkthroughState>(walkthroughState);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = walkthroughState;
  }, [walkthroughState]);


  const setupStepEventListeners = useCallback((step: WalkthroughStep) => {
    if (!step.condition) return;

    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (conditionCheckRef.current) {
        clearInterval(conditionCheckRef.current);
      }
    };

    cleanup(); // Clear any existing listeners

    switch (step.condition) {
      case 'messageSendButtonClicked':
        const handleButtonClick = () => {
          const currentState = stateRef.current;
          const currentStep = currentState.config?.steps[currentState.currentStepIndex];
          const canAdvance = currentState.isActive && 
            currentState.currentStepIndex < (currentState.config?.steps.length || 0) - 1 &&
            currentStep?.id === step.id;

          if (canAdvance) {
            const nextIndex = currentState.currentStepIndex + 1;
            const nextStep = currentState.config?.steps[nextIndex];
            setWalkthroughState(prev => ({
              ...prev,
              currentStepIndex: nextIndex,
              highlightedElement: nextStep?.targetSelector 
                ? document.querySelector(nextStep.targetSelector)
                : null
            }));
          }
        };

        // Remove any existing event handlers first
        window.removeEventListener('messageSendButtonClicked', handleButtonClick);
        window.addEventListener('messageSendButtonClicked', handleButtonClick);
        
        return () => {
          window.removeEventListener('messageSendButtonClicked', handleButtonClick);
          cleanup();
        };

      case 'navIsOpen':
        // Check if nav is already open when step is set up
        const navState = StorageHelper.getNavigationPanelState();
        console.log('Initial nav state check:', {
          stepId: step.id,
          navCollapsed: navState.collapsed
        });

        // Function to advance to next step
        const advanceToNextStep = () => {
          const currentState = stateRef.current;
          const currentStep = currentState.config?.steps[currentState.currentStepIndex];
          const canAdvance = currentState.isActive && 
            currentState.currentStepIndex < (currentState.config?.steps.length || 0) - 1 &&
            currentStep?.id === step.id;

          console.log('Navigation open state check:', {
            isActive: currentState.isActive,
            currentStepIndex: currentState.currentStepIndex,
            currentStepId: currentStep?.id,
            expectedStepId: step.id,
            canAdvance
          });

          if (canAdvance) {
            const nextIndex = currentState.currentStepIndex + 1;
            const nextStep = currentState.config?.steps[nextIndex];
            console.log('Advancing to next step:', {
              from: currentStep?.id,
              to: nextStep?.id
            });
            // First update the step index
            setWalkthroughState(prev => ({
              ...prev,
              currentStepIndex: nextIndex,
              highlightedElement: null // Clear current highlight
            }));
            
            // Let the DOM update, then set the new highlight
            setTimeout(() => {
              if (nextStep?.targetSelector) {
                const newTarget = document.querySelector(nextStep.targetSelector);
                console.log('Setting new highlight target:', {
                  selector: nextStep.targetSelector,
                  found: !!newTarget
                });
                setWalkthroughState(prev => ({
                  ...prev,
                  highlightedElement: newTarget
                }));
              }
            }, 0);
          } else {
            console.log('Not advancing - conditions not met');
          }
        };

        // If nav is already open, advance immediately
        if (!navState.collapsed) {
          console.log('Nav already open, advancing immediately');
          advanceToNextStep();
        }

        // Set up listener for nav open event
        const handleNavOpen = () => {
          console.log('navigationOpened event received');
          advanceToNextStep();
        };

        console.log('Setting up navigationOpened listener for step:', step.id);
        // Remove any existing event handlers first
        window.removeEventListener('navigationOpened', handleNavOpen);
        window.addEventListener('navigationOpened', handleNavOpen);
        
        return () => {
          console.log('Cleaning up navigationOpened listener for step:', step.id);
          window.removeEventListener('navigationOpened', handleNavOpen);
          cleanup();
        };

      case 'toolIsOpen':
        // Function to advance to next step
        const handleToolsAdvance = () => {
          console.log('toolIsOpen event received');
          const currentState = stateRef.current;
          const currentStep = currentState.config?.steps[currentState.currentStepIndex];
          const canAdvance = currentState.isActive && 
            currentState.currentStepIndex < (currentState.config?.steps.length || 0) - 1 &&
            currentStep?.id === step.id;

          console.log('Tools state check:', {
            isActive: currentState.isActive,
            currentStepIndex: currentState.currentStepIndex,
            currentStepId: currentStep?.id,
            expectedStepId: step.id,
            canAdvance
          });

          if (canAdvance) {
            const nextIndex = currentState.currentStepIndex + 1;
            const nextStep = currentState.config?.steps[nextIndex];
            console.log('Advancing to next step:', {
              from: currentStep?.id,
              to: nextStep?.id
            });
            setWalkthroughState(prev => ({
              ...prev,
              currentStepIndex: nextIndex,
              highlightedElement: nextStep?.targetSelector 
                ? document.querySelector(nextStep.targetSelector)
                : null
            }));
          } else {
            console.log('Not advancing - conditions not met');
          }
        };

        // Check if tools panel is already open
        const toolsState = document.querySelector(step.targetSelector!)?.getAttribute('aria-expanded') === 'true';
        console.log('Initial tools state check:', {
          stepId: step.id,
          toolsIsOpen: toolsState
        });

        if (toolsState) {
          console.log('Tools panel already open, advancing immediately');
          handleToolsAdvance();
        }

        // Set up listener for tools open event
        const handleToolsOpen = () => {
          handleToolsAdvance();
        };

        console.log('Setting up toolIsOpen listener for step:', step.id);
        // Remove any existing event handlers first
        window.removeEventListener('toolIsOpen', handleToolsOpen);
        window.addEventListener('toolIsOpen', handleToolsOpen);
        
        return () => {
          console.log('Cleaning up toolIsOpen listener for step:', step.id);
          window.removeEventListener('toolIsOpen', handleToolsOpen);
          cleanup();
        };

      case 'closeInfoPanelButtonClicked':
        const handleInfoPanelClose = () => {
          console.log('closeInfoPanelButtonClicked event received');
          const currentState = stateRef.current;
          const currentStep = currentState.config?.steps[currentState.currentStepIndex];
          const canAdvance = currentState.isActive && 
            currentState.currentStepIndex < (currentState.config?.steps.length || 0) - 1 &&
            currentStep?.id === step.id;

          console.log('Info panel close state check:', {
            isActive: currentState.isActive,
            currentStepIndex: currentState.currentStepIndex,
            currentStepId: currentStep?.id,
            expectedStepId: step.id,
            canAdvance
          });

          if (canAdvance) {
            const nextIndex = currentState.currentStepIndex + 1;
            const nextStep = currentState.config?.steps[nextIndex];
            console.log('Advancing to next step:', {
              from: currentStep?.id,
              to: nextStep?.id
            });
            setWalkthroughState(prev => ({
              ...prev,
              currentStepIndex: nextIndex,
              highlightedElement: nextStep?.targetSelector 
                ? document.querySelector(nextStep.targetSelector)
                : null
            }));
          } else {
            console.log('Not advancing - conditions not met');
          }
        };

        console.log('Setting up closeInfoPanelButtonClicked listener for step:', step.id);
        // Remove any existing event handlers first
        window.removeEventListener('closeInfoPanelButtonClicked', handleInfoPanelClose);
        window.addEventListener('closeInfoPanelButtonClicked', handleInfoPanelClose);
        
        return () => {
          console.log('Cleaning up closeInfoPanelButtonClicked listener for step:', step.id);
          window.removeEventListener('closeInfoPanelButtonClicked', handleInfoPanelClose);
          cleanup();
        };

      case 'messageReceived':
        // Set up a listener for message completion events
        const handleMessageReceived = () => {
          // Small delay to ensure state is updated
          setTimeout(() => {
            const currentState = stateRef.current;
            if (currentState.isActive && currentState.currentStepIndex < (currentState.config?.steps.length || 0) - 1) {
              const nextIndex = currentState.currentStepIndex + 1;
              setWalkthroughState(prev => ({
                ...prev,
                currentStepIndex: nextIndex,
                highlightedElement: prev.config?.steps[nextIndex]?.targetSelector 
                  ? document.querySelector(prev.config.steps[nextIndex].targetSelector!)
                  : null
              }));
            }
          }, 500);
        };

        // Add the event listener
        window.addEventListener('messageReceived', handleMessageReceived);

        return () => {
          window.removeEventListener('messageReceived', handleMessageReceived);
          cleanup();
        };
    }

    return cleanup;
  }, []);

  const updateHighlightedElement = useCallback((step: WalkthroughStep) => {
    if (!step.targetSelector) {
      setWalkthroughState(prev => ({ ...prev, highlightedElement: null }));
      return;
    }

    const highlightData = createHighlightHole(step.targetSelector);
    if (highlightData) {
      setWalkthroughState(prev => ({
        ...prev,
        highlightedElement: highlightData.element
      }));
    } else {
      setWalkthroughState(prev => ({ ...prev, highlightedElement: null }));
    }
  }, []);

  const startWalkthrough = useCallback(async (configId: string) => {
    setIsLoading(true);
    try {
      const config = await loadWalkthroughConfig('/walkthrough-config.yaml');
      setWalkthroughState({
        isActive: true,
        currentStepIndex: 0,
        config,
        highlightedElement: null,
      });

      // Setup the first step - add safety check
      if (config.steps && config.steps.length > 0) {
        const firstStep = config.steps[0];
        updateHighlightedElement(firstStep);
        setupStepEventListeners(firstStep);
      }
    } catch (error) {
      console.error('Failed to start walkthrough:', error);
      setWalkthroughState({
        isActive: false,
        currentStepIndex: 0,
        config: null,
        highlightedElement: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateHighlightedElement, setupStepEventListeners]);

  const nextStep = useCallback(() => {
    setWalkthroughState(prev => {
      if (!prev.isActive || !prev.config || !prev.config.steps) return prev;

      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex >= prev.config.steps.length) {
        // Walkthrough completed
        return { ...prev, isActive: false, highlightedElement: null };
      }

      const nextStep = prev.config.steps[nextIndex];
      if (nextStep) {
        updateHighlightedElement(nextStep);
      }

      return {
        ...prev,
        currentStepIndex: nextIndex,
        highlightedElement: nextStep?.targetSelector ? document.querySelector(nextStep.targetSelector) : null,
      };
    });
  }, [updateHighlightedElement]);

  const previousStep = useCallback(() => {
    setWalkthroughState(prev => {
      if (!prev.isActive || !prev.config || !prev.config.steps || prev.currentStepIndex === 0) return prev;

      const prevIndex = prev.currentStepIndex - 1;
      const prevStep = prev.config.steps[prevIndex];
      if (prevStep) {
        updateHighlightedElement(prevStep);
      }

      return {
        ...prev,
        currentStepIndex: prevIndex,
        highlightedElement: prevStep?.targetSelector ? document.querySelector(prevStep.targetSelector) : null,
      };
    });
  }, [updateHighlightedElement]);

  const skipWalkthrough = useCallback(() => {
    setWalkthroughState({
      isActive: false,
      currentStepIndex: 0,
      config: null,
      highlightedElement: null,
    });
  }, []);

  // Update event listeners when step changes
  useEffect(() => {
    if (!walkthroughState.isActive || !walkthroughState.config || !walkthroughState.config.steps) {
      return;
    }

    const currentStep = walkthroughState.config.steps[walkthroughState.currentStepIndex];
    if (currentStep) {
      updateHighlightedElement(currentStep);
      const cleanup = setupStepEventListeners(currentStep);
      return () => cleanup?.();
    }
  }, [walkthroughState.isActive, walkthroughState.currentStepIndex, walkthroughState.config, updateHighlightedElement, setupStepEventListeners]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (conditionCheckRef.current) clearInterval(conditionCheckRef.current);
    };
  }, []);

  return {
    walkthroughState,
    startWalkthrough,
    nextStep,
    previousStep,
    skipWalkthrough,
    isLoading,
  };
}
