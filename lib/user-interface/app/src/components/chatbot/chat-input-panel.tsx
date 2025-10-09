import {
  Button,
  Container,
  Icon,
  Select,
  SelectProps,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Auth } from "aws-amplify";
import TextareaAutosize from "react-textarea-autosize";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import styles from "../../styles/chat.module.scss";

import {  
  ChatBotHistoryItem,  
  ChatBotMessageType,
  ChatInputState,  
} from "./types";

import {  
  assembleHistory
} from "./utils";

import { Utils } from "../../common/utils";
import {SessionRefreshContext} from "../../common/session-refresh-context"
import { useNotifications } from "../notif-manager";
import PromptButtons from "./prompt-buttons";

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;  
  showPromptButtons?: boolean;
  suggestedPrompts?: string[];
  onSuggestedPromptsUpdate?: (prompts: string[]) => void;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const {needsRefresh, setNeedsRefresh} = useContext(SessionRefreshContext);  
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    value: "",
    
  });
  const { notifications, addNotification } = useNotifications();
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.OPEN
  );  
  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);

  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;    
  }, [props.messageHistory]);

  // Handle input value changes
  const handleInputChange = (value: string) => {
    setState(state => ({ ...state, value }));
  };

  // Handle prompt button clicks
  const handlePromptClick = (prompt: string) => {
    setState(prev => ({ ...prev, value: prompt }));
    // Focus the textarea after setting the value
    const textarea = document.querySelector(`.${styles.input_textarea}`) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };
  


  /** Speech recognition */
  useEffect(() => {
    if (transcript) {
      handleInputChange(transcript);
    }
  }, [transcript]);


  /**Some amount of auto-scrolling for convenience */
  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
          window.scrollY -
          document.documentElement.scrollHeight
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  /**Sends a message to the chat API */
  const handleSendMessage = async (promptMessage?: string) => {    
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;

    let username;
    await Auth.currentAuthenticatedUser().then((value) => username = value.username);
    if (!username) return;    

    const messageToSend = (promptMessage || state.value).trim();
    if (messageToSend.length === 0) {
      addNotification("error","Please do not submit blank text!");
      return;          
    }
    setState({ value: "" });    
    
    try {
      props.setRunning(true);
      let receivedData = '';      
      
      /**Add the user's query to the message history and a blank dummy message
       * for the chatbot as the response loads
       */
      messageHistoryRef.current = [
        ...messageHistoryRef.current,

        {
          type: ChatBotMessageType.Human,
          content: messageToSend,
          metadata: {            
          },
          messageId: "",
          userFeedback: {},
          userId: "",
          title: "",
          createdAt: "",
        },
        {
          type: ChatBotMessageType.AI,          
          content: receivedData,
          metadata: {},
          messageId: "",
          userFeedback: {},
          userId: "",
          title: "",
          createdAt: "",
        },
      ];
      props.setMessageHistory(messageHistoryRef.current);

      let firstTime = false;
      if (messageHistoryRef.current.length < 3) {
        firstTime = true;
      }
      // old non-auth url -> const wsUrl = 'wss://ngdpdxffy0.execute-api.us-east-1.amazonaws.com/test/'; 
      // old shared url with auth -> wss://caoyb4x42c.execute-api.us-east-1.amazonaws.com/test/     
      // first deployment URL 'wss://zrkw21d01g.execute-api.us-east-1.amazonaws.com/prod/';
      const TEST_URL = appContext.wsEndpoint+"/"

      // Get a JWT token for the API to authenticate on      
      const TOKEN = await Utils.authenticate()
                
      const wsUrl = TEST_URL+'?Authorization='+TOKEN;
      const ws = new WebSocket(wsUrl);

      let incomingMetadata: boolean = false;
      let sources = {};

      /**If there is no response after a minute, time out the response to try again. */
      setTimeout(() => {if (receivedData == '') {
        ws.close()
        messageHistoryRef.current.pop();
        messageHistoryRef.current.push({
          type: ChatBotMessageType.AI,          
          content: `Sorry, I had a bit of trouble processing that question, please type it again in the search bar. I'll try my best to help you with your questions.`,
          metadata: {},
          messageId: "",
          userFeedback: {},
          userId: "",
          title: "",
          createdAt: "",
        })
      }},60000)

      // Event listener for when the connection is open
      ws.addEventListener('open', function open() {
        console.log('Connected to the WebSocket server');        
        const message = JSON.stringify({
          "action": "getChatbotResponse",
          "data": {
            userMessage: messageToSend,
            chatHistory: assembleHistory(messageHistoryRef.current.slice(0, -2)),
            projectId: 'rsrs111111',
            user_id: username,
            session_id: props.session.id
          }
        });
        ws.send(message);
      });
      // Event listener for incoming messages
      ws.addEventListener('message', async function incoming(data) {
        let parsedData;
        // Attempt to parse the incoming data
        try {
          parsedData = JSON.parse(data.data);
          // Check for specific error message and skip this message if it matches
          if (parsedData.message === "Endpoint request timed out") {
            console.log("API Gateway Timeout Message Caught");
            return; // Skip this message
          }
        } catch {
          // Not timeout error, do nothing
        }

        /**This is a custom tag from the API that denotes that an error occured
         * and the next chunk will be an error message. */              
        if (data.data.includes("<!ERROR!>:")) {
          addNotification("error",data.data);          
          ws.close();
          return;
        }
        /**This is a custom tag from the API that denotes when the model response
         * ends and when the sources are coming in
         */
        if (data.data == '!<|EOF_STREAM|>!') {          
          incomingMetadata = true;
          return;          
        }
        if (!incomingMetadata) {
          receivedData += data.data;
        }

        let messageId = "";
        let sourceJson = {};
        let suggestedPrompts: string[] = [];

        console.log("Full received data:", receivedData);
        
        // Parse Message ID
        if (receivedData.includes("<!MessageId!>:")) {
          const messageIdMatch = receivedData.match(/<!MessageId!>:\s*([^\s<!]+)/);
          if (messageIdMatch) {
            messageId = messageIdMatch[1];
            console.log("Parsed Message ID:", messageId);
          }
        }

        // Parse Sources
        if (receivedData.includes("<!Sources!>:")) {
          try {
            const sourcesMatch = receivedData.match(/<!Sources!>:\s*(\[.*?\])(?:\s|<!|$)/);
            if (sourcesMatch) {
              const sourceData = JSON.parse(sourcesMatch[1]);
              sourceJson = {"Sources": sourceData};
              console.log("Parsed Sources:", sourceJson);
            }
          } catch (e) {
            console.log("Error parsing sources:", e);
          }
        }

        // Parse Prompts
        if (receivedData.includes("<!Prompts!>:")) {
          try {
            console.log("Found Prompts tag in data");
            const promptsMatch = receivedData.match(/<!Prompts!>:\s*(\[.*?\])(?:\s|<!|$)/);
            console.log("Prompts regex match:", promptsMatch);
            if (promptsMatch) {
              console.log("Raw prompts data:", promptsMatch[1]);
              try {
                suggestedPrompts = JSON.parse(promptsMatch[1]);
                console.log("Successfully parsed suggested prompts:", suggestedPrompts);
                if (Array.isArray(suggestedPrompts) && suggestedPrompts.length > 0) {
                  if (props.onSuggestedPromptsUpdate) {
                    console.log("Updating suggested prompts via callback");
                    props.onSuggestedPromptsUpdate(suggestedPrompts);
                  } else {
                    console.log("No onSuggestedPromptsUpdate callback provided");
                  }
                } else {
                  console.log("Parsed prompts is not a non-empty array:", suggestedPrompts);
                }
              } catch (parseError) {
                console.error("JSON parse error for prompts:", parseError);
                console.log("Failed to parse JSON string:", promptsMatch[1]);
              }
            } else {
              console.log("No valid prompts format found in data");
            }
          } catch (e) {
            console.error("Error in prompts regex match:", e);
            console.log("Full received data for debugging:", receivedData);
          }
        } else {
          console.log("No prompts tag found in data");
        }
        // Update the chat history state with the new message      
        messageHistoryRef.current = [
          ...messageHistoryRef.current.slice(0, -2),

          {
            type: ChatBotMessageType.Human,
            content: messageToSend,
            metadata: {},
            messageId: messageId,
            userFeedback: {},
            userId: "",
            title: "",
            createdAt: "",
          },
          {
            type: ChatBotMessageType.AI,            
            content: receivedData.split("<!MessageId!>:")[0],
            metadata: sourceJson,
            messageId: messageId,
            userFeedback: {},
            userId: "",
            title: "",
            createdAt: "",
          },
        ];        
        props.setMessageHistory(messageHistoryRef.current);        
      });

      // Handle possible errors
      ws.addEventListener('error', function error(err) {
        console.error('WebSocket error:', err);
      });
      // Handle WebSocket closure
      ws.addEventListener('close', async function close() {
        // if this is a new session, the backend will update the session list, so
        // we need to refresh        
        if (firstTime) {             
          Utils.delay(1500).then(() => setNeedsRefresh(true));
        }
        props.setRunning(false);
        // Dispatch event for message completion
        window.dispatchEvent(new Event('messageReceived'));
        console.log('Disconnected from the WebSocket server');
      });

    } catch (error) {      
      console.error('Error sending message:', error);
      alert('Sorry, something has gone horribly wrong! Please try again or refresh the page.');
      props.setRunning(false);
      // Dispatch event for error cases too
      window.dispatchEvent(new Event('messageReceived'));
    }     
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return (
    <SpaceBetween direction="vertical" size="xs" className="chat-input-container">
      {props.showPromptButtons && (
        <PromptButtons 
          onPromptClick={handlePromptClick}
          customPrompts={props.suggestedPrompts}
        />
      )}
      <Container>
        <div className={styles.input_textarea_container}>
          <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
            {browserSupportsSpeechRecognition ? (
              <Button
                iconName={listening ? "microphone-off" : "microphone"}
                variant="icon"
                ariaLabel="microphone-access"
                onClick={() =>
                  listening
                    ? SpeechRecognition.stopListening()
                    : SpeechRecognition.startListening()
                }
              />
            ) : (
              <Icon name="microphone-off" variant="disabled" />
            )}
          </SpaceBetween>          
          <TextareaAutosize
            className={styles.input_textarea}
            maxRows={6}
            minRows={1}
            spellCheck={true}
            autoFocus
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key == "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            value={state.value}
            placeholder={"Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>            
            <Button
              id="chat-send-button"
              disabled={
                readyState !== ReadyState.OPEN ||                
                props.running ||
                state.value.trim().length === 0 ||
                props.session.loading
              }
              onClick={() => {
                handleSendMessage();
                // Dispatch a custom event for the walkthrough
                window.dispatchEvent(new Event('messageSendButtonClicked'));
              }}
              iconAlign="right"
              iconName={!props.running ? "angle-right-double" : undefined}
              variant="primary"
            >
              {props.running ? (
                <>
                  Loading&nbsp;&nbsp;
                  <Spinner />
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      </Container>
      <div className={styles.input_controls}>      
        <div>
        </div>  
        <div className={styles.input_controls_right}>
          <SpaceBetween direction="horizontal" size="xxs" alignItems="center">
            <div style={{ paddingTop: "1px" }}>              
            </div>
            <StatusIndicator
              type={
                readyState === ReadyState.OPEN
                  ? "success"
                  : readyState === ReadyState.CONNECTING ||
                    readyState === ReadyState.UNINSTANTIATED
                    ? "in-progress"
                    : "error"
              }
            >
              {readyState === ReadyState.OPEN ? "Connected" : connectionStatus}
            </StatusIndicator>
          </SpaceBetween>
        </div>
      </div>
    </SpaceBetween>
  );
}

