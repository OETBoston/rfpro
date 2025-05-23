import {
  SideNavigation,
  SideNavigationProps,
  Header,
  Button,
  Box,
  SpaceBetween,
  StatusIndicator
} from "@cloudscape-design/components";
import PointerIcon from "../../public/images/pointer-icon.jsx";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import RouterButton from "../components/wrappers/router-button";
import { useContext, useState, useEffect } from "react";
import { ApiClient } from "../common/api-client/api-client";
import { Auth } from "aws-amplify";
import { v4 as uuidv4 } from "uuid";
import { SessionRefreshContext } from "../common/session-refresh-context"
import { useNotifications } from "../components/notif-manager";
import { Utils } from "../common/utils.js";
import { useAdmin } from "../common/admin-context.js";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [items, setItems] = useState<SideNavigationProps.Item[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const { needsRefresh, setNeedsRefresh } = useContext(SessionRefreshContext);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const { addNotification, removeNotification } = useNotifications();
  const [activeHref, setActiveHref] = useState(
    window.location.pathname
  );
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();

  // update the list of sessions
  const loadSessions = async () => {
    if (isAdminLoading) {
      console.log("Waiting for admin status to be determined...");
      return;
    }

    let username;
    try {
      await Auth.currentAuthenticatedUser().then((value) => username = value.username);
      if (username && needsRefresh) {
        const fetchedSessions = await apiClient.sessions.getSessions(username);
        await updateItems(fetchedSessions);
        console.log("fetched sessions");
        if (!loaded) {
          setLoaded(true);
        }
        setNeedsRefresh(false);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      setLoaded(true);
      addNotification("error", "Could not load sessions:".concat(error.message));
      addNotification("info", "Please refresh the page");
    } finally {
      setLoadingSessions(false);
    }
  }

  // this hook allows other components (specifically the chat handler)
  // to request a session refresh (such as if a chat has just been created)
  useEffect(() => {
    if (!isAdminLoading) {
      loadSessions();
    }
  }, [needsRefresh, isAdmin, isAdminLoading]);


  const onReloadClick = async () => {
    await loadSessions();
    const id = addNotification("success", "Sessions reloaded successfully!");
    Utils.delay(3000).then(() => removeNotification(id))
  };


  const updateItems = async (sessions) => {
    let newItems: SideNavigationProps.Item[] = [
      {
        type: "section",
        text: "Session History",
        items: sessions.map(session => ({
          type: "link",
          text: `${session.title}`,
          href: `/chatbot/playground/${session.session_id}`,
        })).concat([{
          type: "link",
          info: <Box margin="xxs" textAlign="center" >
            <SpaceBetween size="xs">
            <RouterButton href={"/chatbot/sessions"} loading={loadingSessions} variant="link">View All Sessions</RouterButton>
            <Button onClick={onReloadClick} iconName="refresh" loading={loadingSessions} variant="link">Reload Sessions</Button>            
            </SpaceBetween>
            </Box>
        }]),
      },
    ];
    console.log(isAdmin)
    if (isAdmin) {
      newItems.push({
        type: "section",
        text: "Admin",
        items: [
          { type: "link", text: "Documents", href: "/admin/data" },
          { type: "link", text: "Message Feedback", href: "/admin/user-feedback" },
          { type: "link", text: "All Sessions", href: "/admin/all-sessions" }
        ],
      },)
    }
    setItems(newItems);
  };

  const onChange = ({
    detail,
  }: {
    detail: SideNavigationProps.ChangeDetail;
  }) => {
    // const sectionIndex = items.findIndex(detail.item);
    const sectionIndex = items.indexOf(detail.item);
    setNavigationPanelState({
      collapsedSections: {
        ...navigationPanelState.collapsedSections,
        [sectionIndex]: !detail.expanded,
      },
    });
  };


  return (
    <div>
      <Box margin="xs" padding={{ top: "l" }} textAlign="center">
        <RouterButton
          iconAlign="right"
          iconSvg={<PointerIcon />}
          variant="primary"
          href={`/chatbot/playground/${uuidv4()}`}
          data-alignment="right"
          className="new-chat-button"
          style={{ textAlign: "right" }}
        >
          New session
        </RouterButton>
      </Box>
      {loaded ?
        <SideNavigation
          activeHref={activeHref}
          // onFollow={onFollow}
          onFollow={event => {
            if (!event.detail.external) {
              event.preventDefault();
              setActiveHref(event.detail.href);
              onFollow(event);
            }
          }}
          onChange={onChange}
          items={items}
        /> :
        <Box margin="xs" padding="xs" textAlign="center">
          <StatusIndicator type="loading">Loading sessions...</StatusIndicator>
        </Box>}
    </div>
  );
}