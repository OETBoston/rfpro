import { WalkthroughConfig, WalkthroughCondition } from '../types';

export interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ModalPosition {
  top: number;
  left: number;
}

/**
 * Get the position and dimensions of a DOM element
 */
export function getElementPosition(selector: string): ElementPosition | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  // Use viewport-relative position directly
  const rect = element.getBoundingClientRect();
  
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Calculate the best position for the walkthrough modal based on the target element and preferred position
 */
export function calculateModalPosition(
  targetPosition: ElementPosition,
  preferredPosition: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'screen-center' = 'center',
  modalWidth: number = 400,
  modalHeight: number = 300
): ModalPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 20;

  switch (preferredPosition) {
    case 'top':
      // For button targets, ensure more space between modal and target
      const verticalPadding = targetPosition.height < 50 ? 40 : padding; // More padding for small targets like buttons
      return {
        top: Math.max(padding, targetPosition.top - modalHeight - verticalPadding),
        left: Math.max(
          padding,
          Math.min(
            viewportWidth - modalWidth - padding,
            targetPosition.left + (targetPosition.width - modalWidth) / 2
          )
        ),
      };

    case 'bottom':
      return {
        top: Math.min(
          viewportHeight - modalHeight - padding,
          targetPosition.top + targetPosition.height + padding
        ),
        left: Math.max(
          padding,
          Math.min(
            viewportWidth - modalWidth - padding,
            targetPosition.left + (targetPosition.width - modalWidth) / 2
          )
        ),
      };

    case 'left':
      return {
        top: Math.max(
          padding,
          Math.min(
            viewportHeight - modalHeight - padding,
            targetPosition.top + (targetPosition.height - modalHeight) / 2
          )
        ),
        left: Math.max(padding, targetPosition.left - modalWidth - padding),
      };

    case 'right':
      return {
        top: Math.max(
          padding,
          Math.min(
            viewportHeight - modalHeight - padding,
            targetPosition.top + (targetPosition.height - modalHeight) / 2
          )
        ),
        left: Math.min(
          viewportWidth - modalWidth - padding,
          targetPosition.left + targetPosition.width + padding
        ),
      };

    case 'screen-center':
      // Absolute center of screen, ignoring target
      return {
        top: Math.max(padding, (viewportHeight - modalHeight) / 2),
        left: Math.max(padding, (viewportWidth - modalWidth) / 2),
      };

    case 'center':
    default:
      // Center relative to target if exists, otherwise screen center
      return targetPosition ? {
        top: Math.max(padding, targetPosition.top - modalHeight - padding),
        left: Math.max(padding, targetPosition.left + (targetPosition.width - modalWidth) / 2),
      } : {
        top: Math.max(padding, (viewportHeight - modalHeight) / 2),
        left: Math.max(padding, (viewportWidth - modalWidth) / 2),
      };
  }
}

/**
 * Load walkthrough configuration from YAML file
 */
export async function loadWalkthroughConfig(configPath: string): Promise<WalkthroughConfig> {
  try {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`Failed to load walkthrough config: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const config = parseYAML(yamlText);

    // Validate the parsed config structure
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid walkthrough config: config must be an object');
    }

    if (!config.id || !config.title || !config.description) {
      throw new Error('Invalid walkthrough config: missing required fields (id, title, description)');
    }

    if (!Array.isArray(config.steps) || config.steps.length === 0) {
      throw new Error('Invalid walkthrough config: steps must be a non-empty array');
    }

    // Validate each step
    config.steps.forEach((step, index) => {
      if (!step.id || !step.title || !step.text) {
        throw new Error(`Invalid step ${index}: missing required fields (id, title, text)`);
      }
    });

    return config as WalkthroughConfig;
  } catch (error) {
    console.error('Error loading walkthrough config:', error);
    throw error;
  }
}

/**
 * Simple YAML parser for basic walkthrough config
 */
function parseYAML(yamlText: string): any {
  const lines = yamlText.split('\n');
  const result: any = {};
  let currentStep: any = null;
  let inSteps = false;

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const indent = lines[i].match(/^(\s*)/)?.[1]?.length || 0;
      const isArrayItem = line.startsWith('- ');
      const keyValue = line.replace(/^- /, '').split(': ');

      // Handle main config keys (id, title, description)
      if (!isArrayItem && keyValue.length >= 2 && indent === 0) {
        const key = keyValue[0];
        const value = parseValue(keyValue.slice(1).join(': '));
        result[key] = value;
      }

      // Handle steps array
      if (keyValue.length === 1 && keyValue[0].replace(':', '') === 'steps') {
        inSteps = true;
        result.steps = [];
        continue;
      }

      if (inSteps && isArrayItem) {
        // Start of a new step
        currentStep = {};
        result.steps.push(currentStep);
      }

      if (currentStep && keyValue.length >= 2) {
        // Properties of current step
        const key = keyValue[0];
        const value = parseValue(keyValue.slice(1).join(': '));

        currentStep[key] = value;
      }

      // No need to handle nested objects anymore
    }
  } catch (error) {
    console.error('YAML parsing error:', error);
    throw new Error('Failed to parse walkthrough configuration');
  }

  return result;
}


/**
 * Parse YAML values
 */
function parseValue(value: string): any {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}


/**
 * Create a hole in the mask for a specific element
 */
export function createHighlightHole(selector: string): { element: Element; position: ElementPosition } | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  const position = getElementPosition(selector);
  if (!position) return null;

  return { element, position };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  }) as T;
}
