import { AppLayout, AppLayoutProps, Flashbar } from "@cloudscape-design/components";
import { useEffect } from "react";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import NavigationPanel from "./navigation-panel";
import { ReactElement, useState } from "react";
import { SessionRefreshContext } from "../common/session-refresh-context"
import { NotificationProvider } from "./notif-manager";
import NotificationBar from "./notif-flashbar"

export default function BaseAppLayout(
  props: AppLayoutProps & { info?: ReactElement }
) {
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [toolsOpen, setToolsOpen] = useState(false);  
  const [needsRefresh, setNeedsRefresh] = useState(true);

  // Add class to navigation toggle button on mount and when navigation state changes
  useEffect(() => {
    const addNavToggleClass = () => {
      const toggleButton = document.querySelector('button[aria-haspopup="true"][type="button"]');
      if (toggleButton) {
        toggleButton.classList.add('nav-toggle-button');
      }
    };

    // Initial class addition
    addNavToggleClass();

    // Set up a mutation observer to watch for button changes
    const observer = new MutationObserver(addNavToggleClass);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [navigationPanelState.collapsed]);


  return (
    <SessionRefreshContext.Provider value={{ needsRefresh, setNeedsRefresh }}>
      <NotificationProvider>
        <AppLayout
          className="app-layout-container"
          headerSelector="#awsui-top-navigation"
          navigation={<NavigationPanel />}
          navigationOpen={!navigationPanelState.collapsed}
          onNavigationChange={({ detail }) =>
            setNavigationPanelState({ collapsed: !detail.open })
          }
          toolsHide={props.info === undefined ? true : false}
          tools={props.info}
          toolsOpen={toolsOpen}
          stickyNotifications={true}
          notifications={<NotificationBar />}
          onToolsChange={({ detail }) => {
            setToolsOpen(detail.open);
            if (detail.open) {
              window.dispatchEvent(new Event('toolIsOpen'));
            } else {
              window.dispatchEvent(new Event('closeInfoPanelButtonClicked'));
            }
          }}
          {...props}
        />
      </NotificationProvider>
    </SessionRefreshContext.Provider>
  );
}
