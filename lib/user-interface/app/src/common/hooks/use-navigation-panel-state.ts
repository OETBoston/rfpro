import { useState } from "react";
import { StorageHelper } from "../helpers/storage-helper";
import { NavigationPanelState } from "../types";

export function useNavigationPanelState(): [
  NavigationPanelState,
  (state: Partial<NavigationPanelState>) => void,
] {
  const [currentState, setCurrentState] = useState(
    StorageHelper.getNavigationPanelState()
  );

  const onChange = (state: Partial<NavigationPanelState>) => {
    console.log('Navigation panel state change:', {
      oldState: currentState,
      newState: state,
      isOpening: state.collapsed === false
    });
    const newState = StorageHelper.setNavigationPanelState(state);
    setCurrentState(newState);
    // Dispatch event when nav is opened
    if (state.collapsed === false) {
      console.log('Dispatching navigationOpened event');
      window.dispatchEvent(new Event('navigationOpened'));
      console.log('navigationOpened event dispatched');
    }
  };

  return [currentState, onChange];
}
