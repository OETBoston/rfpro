# Walkthrough Feature

This directory contains the walkthrough feature that provides interactive guided tours of the BidBot chat interface.

## Components

### `walkthrough.tsx`
The main walkthrough component that manages the overall state and integration with the chat interface.

### `walkthrough-modal.tsx`
The modal component that displays each step of the walkthrough with:
- Background mask overlay
- Highlighted target elements with holes in the mask
- Step content (title, text, hint)
- Navigation controls
- Positioning logic

### `walkthrough.module.scss`
SCSS styles for the walkthrough modal and mask with:
- Responsive design
- Accessibility support (high contrast, reduced motion)
- Smooth animations
- Cross-browser compatibility

## Configuration

The walkthrough is configured via `public/walkthrough-config.yaml`:

```yaml
id: "chat-interface-walkthrough"
title: "Getting Started with BidBot"
description: "Learn how to use BidBot's chat interface effectively"
steps:
  - id: "welcome"
    title: "Welcome to BidBot!"
    text: "This walkthrough will show you how to use BidBot's chat interface."
    hint: "Click 'Next' to continue or 'Skip' to exit the walkthrough."
    position: "center"

  - id: "prompt-buttons"
    title: "Quick Prompts"
    text: "These pre-written prompts are designed to help you get started quickly."
    targetSelector: ".prompt-buttons-container"
    position: "top"
    condition:
      type: "click"
      selector: ".prompt-buttons-container button"
```

## Features

### Step Types
- **Manual progression**: Users click "Next" to advance
- **Automatic progression**: Steps advance based on conditions
- **Conditional advancement**: Steps can wait for user interactions

### Conditions
- **click**: Wait for click on specific element
- **messageReceived**: Wait for new chat message
- **timeout**: Wait for specified time
- **custom**: Custom function-based condition

### Positioning
- **center**: Modal centered on screen
- **top/bottom/left/right**: Modal positioned relative to highlighted element
- **Responsive**: Adapts to screen size and orientation

### Accessibility
- Keyboard navigation support (Escape to close)
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences respected

## Usage

### Basic Integration
```tsx
import Walkthrough from '../components/walkthrough/walkthrough';

function Chat() {
  return (
    <div>
      {/* Your chat interface */}

      <Walkthrough
        configId="chat-interface-walkthrough"
        onComplete={() => console.log('Walkthrough completed')}
        onSkip={() => console.log('Walkthrough skipped')}
      />
    </div>
  );
}
```

### Triggering the Walkthrough
The walkthrough is triggered by calling the global function:
```javascript
window.__walkthroughStart();
```

### Custom CSS Classes
Add these CSS classes to your components to enable walkthrough highlighting:

```css
.prompt-buttons-container  /* For prompt buttons */
.input_textarea_container  /* For chat input area */
.input_controls_right      /* For send button */
.thumbsContainer           /* For feedback buttons */
.btn_chabot_metadata_copy  /* For sources button */
```

## Hooks

### `useWalkthrough()`
Manages walkthrough state and provides functions:

```tsx
const {
  walkthroughState,    // Current walkthrough state
  startWalkthrough,    // Start a walkthrough
  nextStep,           // Advance to next step
  previousStep,       // Go to previous step
  skipWalkthrough,    // Skip entire walkthrough
  isLoading           // Loading state
} = useWalkthrough();
```

## Utilities

### `walkthrough-utils.ts`
Utility functions for:
- DOM element positioning and selection
- YAML configuration parsing
- Modal positioning calculations
- Condition checking
- Element highlighting

## Integration Points

The walkthrough integrates with the chat interface by:
1. Adding a "Take a Tour" button in the welcome text
2. Highlighting specific UI elements during steps
3. Responding to user interactions (clicks, messages)
4. Providing contextual guidance for each feature

## Customization

### Adding New Steps
1. Add new step configuration to `walkthrough-config.yaml`
2. Add required CSS classes to target components
3. Test positioning and highlighting

### Styling
- Modify `walkthrough.module.scss` for visual changes
- Update colors and animations as needed
- Ensure accessibility compliance

### Behavior
- Modify condition types in `types.ts`
- Update logic in `useWalkthrough()` hook
- Add new event handlers as needed

## Browser Support

- Modern browsers with ES6+ support
- CSS Grid and Flexbox support
- CSS custom properties support
- Intersection Observer API (for advanced features)

## Performance

- Lazy loading of walkthrough components
- Debounced position calculations
- Efficient DOM queries and event handling
- Minimal impact on chat interface performance
