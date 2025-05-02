import { useContext, useEffect, useState } from "react";
import {  
  ChatBotHistoryItem,
  ChatBotMessageType,  
  FeedbackData
} from "./types";
import { Auth } from "aws-amplify";
import { SpaceBetween, StatusIndicator, Alert, Flashbar, Header, Link, Box } from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import ChatInputPanel, { ChatScrollState } from "./chat-input-panel";
import styles from "../../styles/chat.module.scss";
import { CHATBOT_NAME } from "../../common/constants";
import { useNotifications } from "../notif-manager";
import { useAdmin } from "../../common/admin-context.js";

export default function Chat(props: { sessionId?: string}) {
  const appContext = useContext(AppContext);
  const isAdmin = useAdmin();
  const [running, setRunning] = useState<boolean>(true);
  const [session, setSession] = useState<{ id: string; loading: boolean }>({
    id: props.sessionId ?? uuidv4(),
    loading: typeof props.sessionId !== "undefined",
  });  

  const { notifications, addNotification } = useNotifications();

  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>(
    []
  );
  const [title, setTitle] = useState<string>("");
  
  /** Loads session history */
  useEffect(() => {
    if (!appContext) return;
    setMessageHistory([]);

    (async () => {
      /** If there is no session ID, then this must be a new session
       * and there is no need to load one from the backend.
       * However, even if a session ID is set and there is no saved session in the 
       * backend, there will be no errors - the API will simply return a blank session
       */
      if (!props.sessionId) {
        setSession({ id: uuidv4(), loading: false });
        return;
      }

      setSession({ id: props.sessionId, loading: true });
      const apiClient = new ApiClient(appContext);
      try {
        // const result = await apiClient.sessions.getSession(props.sessionId);
        let username;
        await Auth.currentAuthenticatedUser().then((value) => username = value.username);
        if (!username) return;
        const hist = await apiClient.sessions.getSession(props.sessionId,username);
        if (hist) {
          
          ChatScrollState.skipNextHistoryUpdate = true;
          ChatScrollState.skipNextScrollEvent = true;
          
          /** Add messageId to message history */
          setMessageHistory(
            hist
              .filter((x) => x !== null)
              .map((x) => ({
                type: x!.type as ChatBotMessageType,
                metadata: x!.metadata!,
                content: x!.content,
                messageId: x!.messageId,
                userFeedback: x!.userFeedback,
                userId: x!.userId,
                title: x!.title,
                createdAt: x!.createdAt,
              }))
          );

          window.scrollTo({
            top: 0,
            behavior: "instant",
          });
        }
        setSession({ id: props.sessionId, loading: false });
        if (hist.length > 1){
          setTitle(parseTitle(hist[0].title, hist[0].createdAt, hist[0].userId));
        }
        setRunning(false);
      } catch (error) {
        console.log(error);
        addNotification("error",error.message)
        addNotification("info","Please refresh the page")
      }
    })();
  }, [appContext, props.sessionId]);

  const parseTitle = (title: string, timestamp: string, userId: string) => {
    const dateObject = new Date(timestamp);
    const dateString = dateObject.toLocaleDateString("en-US", {hour: "numeric", minute: "numeric"});
    return `${title} | ${dateString} | User ID: ${userId}`;
  }

  /** Adds some metadata to the user's feedback */
  const handleFeedback = (feedbackType: "positive" | "negative", idx: number, message: ChatBotHistoryItem, feedbackCategory? : string, feedbackRank? : number, feedbackMessage? : string) => {
    if (props.sessionId) {
      console.log("submitting feedback...")
      
      const prompt = messageHistory[idx - 1].content
      const completion = message.content;
      const messageCompletionId = message.messageId;
      
      const feedbackData = {
        sessionId: props.sessionId, 
        messageId: messageCompletionId,
        feedbackType: feedbackType,
        prompt: prompt,
        completion: completion,
        feedbackCategory: feedbackCategory,
        feedbackRank: feedbackRank,
        feedbackMessage: feedbackMessage,
        sources: JSON.stringify(message.metadata.Sources)
      };
      addUserFeedback(feedbackData);
    }
  };

  /** Makes the API call via the ApiClient to submit the feedback */
  const addUserFeedback = async (feedbackData : FeedbackData) => {
    if (!appContext) return;
    const apiClient = new ApiClient(appContext);
    await apiClient.userFeedback.sendUserFeedback(feedbackData);
  }

  return (
    <div className={styles.chat_container}> 
      <SpaceBetween direction="vertical" size="m">
        
        {messageHistory.length == 0 && !session?.loading && (
        <Alert
            statusIconAriaLabel="Info"
            header=""
        >
          AI Models can make mistakes. Be mindful in validating important information. The tool will capture your responses to ensure that it is giving accurate information, and de-identified questions and responses from only the 5/14/2025 activity will be shared with Harvard researchers for further analysis.
        </Alert> )}

        
        {messageHistory.length > 0 && isAdmin && (
          <Box variant="h1">
            <Link href="/admin/all-sessions"> <strong>{title}</strong> </Link>
          </Box>
        )}

      
        {messageHistory.map((message, idx) => (
          <ChatMessage
            key={idx}
            message={message}            
            onThumbsUp={(feedbackCategory : string, feedbackRank : number, feedbackMessage: string) => handleFeedback("positive", idx, message, feedbackCategory, feedbackRank, feedbackMessage)}
            onThumbsDown={(feedbackCategory : string, feedbackRank : number, feedbackMessage: string) => handleFeedback("negative", idx, message, feedbackCategory, feedbackRank, feedbackMessage)}                        
          />
        ))}
      </SpaceBetween>
      <div className={styles.welcome_text}>
        {messageHistory.length == 0 && !session?.loading && (
          <center>{CHATBOT_NAME}</center>
        )}
        {session?.loading && (
          <center>
            <StatusIndicator type="loading">Loading session</StatusIndicator>
          </center>
        )}
      </div>
      <div className={styles.input_container}>
        <ChatInputPanel
          session={session}
          running={running}
          setRunning={setRunning}
          messageHistory={messageHistory}
          setMessageHistory={(history) => setMessageHistory(history)}          
        />
      </div>
    </div>
  );
}