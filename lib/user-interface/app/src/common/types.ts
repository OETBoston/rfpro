import { SelectProps } from "@cloudscape-design/components";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";

export interface AppConfig {
  Auth: {
        region: string,
        userPoolId: string,
        userPoolWebClientId: string,
        oauth: {
          domain: string,
          scope: string[],
          redirectSignIn: string,
          // redirectSignOut: "https://myapplications.microsoft.com/",
          responseType: string,
        }
      },
      httpEndpoint : string,
      wsEndpoint : string,
      federatedSignInProvider : string,
}

export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}

export type LoadingStatus = "pending" | "loading" | "finished" | "error";
export type AdminDataType =
  | "file"
  | "feedback"
  | "session";

// Walkthrough types
export type WalkthroughCondition = 'messageReceived' | 'messageSendButtonClicked' | 'navIsOpen' | 'toolIsOpen' | 'closeInfoPanelButtonClicked';

export interface WalkthroughStep {
  id: string;
  title: string;
  text: string;
  hint?: string;
  targetSelector?: string;
  condition?: WalkthroughCondition;
  nextButtonText?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  autoAdvance?: boolean;
}

export interface WalkthroughConfig {
  id: string;
  title: string;
  description: string;
  firstStepButtonText: string;
  intermediateStepButtonText: string;
  lastStepButtonText: string;
  steps: WalkthroughStep[];
}

export interface WalkthroughState {
  isActive: boolean;
  currentStepIndex: number;
  config: WalkthroughConfig | null;
  highlightedElement: Element | null;
}
