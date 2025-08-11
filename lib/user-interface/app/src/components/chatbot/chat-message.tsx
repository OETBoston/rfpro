import {
  Box,
  Button,
  Container,
  Popover,
  Spinner,
  StatusIndicator,
  TextContent,
  SpaceBetween,
  ButtonDropdown,
  RadioGroup,
  Modal,
  FormField,
  Input,
  Select
} from "@cloudscape-design/components";
import * as React from "react";
import { useState } from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../../styles/chat.module.scss";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
} from "./types";
import { useAdmin } from "../../common/admin-context";

import "react-json-view-lite/dist/index.css";
import "../../styles/app.scss";
import { useNotifications } from "../notif-manager";
import { Utils } from "../../common/utils";
import {feedbackCategories, feedbackTypes} from '../../common/constants'

// Renaming props to match new feedback schema:
// feedbackTopic -> feedbackCategory
// feedbackType -> feedbackRank
export interface ChatMessageProps {
  message: ChatBotHistoryItem;  
  onThumbsUp: (feedbackCategory : string, feedbackRank : number, feedbackMessage: string) => void;
  onThumbsDown: (feedbackCategory : string, feedbackRank : number, feedbackMessage: string) => void;  
}

export default function ChatMessage(props: ChatMessageProps) {
  const isAdmin = useAdmin();
  const [loading, setLoading] = useState<boolean>(false);
  const { addNotification, removeNotification } = useNotifications();
  const [selectedRankValue, setSelectedRankValue] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<1 | 0 | null>(null); // Tracks thumbs-up/down state
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [hasFirstClick, setHasFirstClick] = useState(true);


  const handleSubmit = () => {
    if (selectedIcon === 0) {
      props.onThumbsDown(selectedIssue || "", selectedRankValue, feedbackMessage.trim());
    } else {
      props.onThumbsUp("", selectedRankValue, feedbackMessage.trim());
    }
    // Reset modal state
    setModalVisible(false);
    setSelectedIssue(null);
    setSelectedRankValue(null);
    setFeedbackMessage("");
    console.log("user feedback");
    console.log(formatUserFeedback(props.message));
  };

  const handleRadioChange = (event) => {
    setSelectedIssue(event.target.value);
  };

  const handleRankButtonClick = (value) => {
    setSelectedRankValue(value);
  };


  const content =
    props.message.content && props.message.content.length > 0
      ? props.message.content
      : "";

  const showSources = props.message.metadata?.Sources && (props.message.metadata.Sources as any[]).length > 0;
  const defaultSource = [{ id: "id", disabled: false, text: "Find these in Finance Academy!", href: "https://sites.google.com/boston.gov/finance-academy/document-library?authuser=0", external: true, externalIconAriaLabel: "(opens in new tab)" }];

  const formatUserFeedback = (message) => {
    const userFeedbackType = message.userFeedback?.feedbackType ? message.userFeedback.feedbackType: "N/A";
    const userFeedbackCategory = message.userFeedback?.feedbackCategory ? " -- " + message.userFeedback.feedbackCategory: "";
    const userFeedbackRank = message.userFeedback?.feedbackRank ? " (" + message.userFeedback.feedbackRank + "/5)": "";
    const userFeedbackMessage = message.userFeedback?.feedbackMessage ? ": " + message.userFeedback.feedbackMessage: "";
    return "#### USER COMMENT:\n```\n" + userFeedbackType + userFeedbackCategory + userFeedbackRank + userFeedbackMessage + "\n```";
  };
  
  return (
    <div>
      <Modal
        onDismiss={() => {
          setModalVisible(false);
          setSelectedIcon(null);
        }}
        visible={modalVisible}
        header="PROVIDE FEEDBACK"
      >
        <SpaceBetween size="l">
          {/* Thumbs-Down Specific Feedback */}
          {selectedIcon === 0 && (
            <FormField label="BIDBOT'S ANSWER WAS..." stretch>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 2fr)' }}>
                <label>
                  <input type="radio" name="category" value="Error Messages" checked={selectedIssue === 'Error Messages'} onChange={handleRadioChange} />
                  Error Messages
                </label>
                <label>
                  <input type="radio" name="category" value="Not Clear" checked={selectedIssue === 'Not Clear'} onChange={handleRadioChange} />
                  Not Clear
                </label>
                <label>
                  <input type="radio" name="category" value="Poorly Formatted" checked={selectedIssue === 'Poorly Formatted'} onChange={handleRadioChange} />
                  Poorly Formatted
                </label>
                <label>
                  <input type="radio" name="category" value="Inaccurate" checked={selectedIssue === 'Inaccurate'} onChange={handleRadioChange} />
                  Inaccurate
                </label>
                <label>
                  <input type="radio" name="category" value="Not Relevant to My Question" checked={selectedIssue === 'Not Relevant to My Question'} onChange={handleRadioChange} />
                  Not Relevant to My Question
                </label>
                <label>
                  <input type="radio" name="category" value="Other" checked={selectedIssue === 'Other'} onChange={handleRadioChange} />
                  Other
                </label>
              </div>

            </FormField>
          )}

          {/* Helpfulness Rating */}
          <FormField label="HOW HELPFUL WAS BIDBOT OVERALL?" stretch>
            <SpaceBetween size="xs" direction="vertical">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <div><Button
                    key={value}
                    variant={selectedRankValue === value ? "primary" : "normal"}
                    onClick={() => setSelectedRankValue(value)}
                  >
                    {value}
                  </Button></div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><Box>Not Helpful</Box></div>
                <div><Box>Very Helpful</Box></div>
              </div>
            </SpaceBetween>
          </FormField>

          {/* Additional Feedback */}
          <FormField label="TELL US MORE..." stretch>
            <Input
              value={feedbackMessage}
              onChange={({ detail }) => setFeedbackMessage(detail.value)}
              placeholder="Provide additional details..."
            />
          </FormField>

          {/* Submit Button */}
          <Box textAlign="center">
            <Button variant="primary" onClick={() => {
              // Submit negative feedback when user presses submit button
              // add notification
              handleSubmit();
              const id = addNotification("success","Thank you for your valuable feedback!");
              Utils.delay(3000).then(() => removeNotification(id));    
            }}>
              Submit
            </Button>
          </Box>
        </SpaceBetween>
      </Modal>

      {props.message?.type === ChatBotMessageType.AI && (
        <Container
          footer={
            (
              <SpaceBetween direction="horizontal" size="s">
              <div
                  onClick={() => {
                    if (!isAdmin && hasFirstClick) {
                      setHasFirstClick(false)
                      const id = addNotification("info", "If you have any questions about these sources, please reach out to the Boston Procurement Department (617-635-4564 or procurement@boston.gov)")
                      Utils.delay(3000).then(() => removeNotification(id));
                    }
                  }}>
                <ButtonDropdown
                  items={
                    (props.message.metadata?.Sources && (props.message.metadata.Sources as any[]).length > 0) ?
                      (props.message.metadata.Sources as any[]).map((item) => {
                        return { id: "id", disabled: true, text: item.title}
                      }).concat(defaultSource) : defaultSource
                  }
                >Sources</ButtonDropdown>
              </div>              
              </SpaceBetween>
            )
          }
        >
          {content?.length === 0 ? (
            <Box>
              <Spinner />
            </Box>
          ) : null}
          {props.message.content.length > 0 ? (
            <div className={styles.btn_chabot_message_copy}>
              <Popover
                size="medium"
                position="top"
                triggerType="custom"
                dismissButton={false}
                content={
                  <StatusIndicator type="success">
                    Copied to clipboard
                  </StatusIndicator>
                }
              >
                <Button
                  variant="inline-icon"
                  iconName="copy"
                  onClick={() => {
                    navigator.clipboard.writeText(props.message.content);
                  }}
                />
              </Popover>
            </div>
          ) : null}
          <ReactMarkdown
            children={content}
            remarkPlugins={[remarkGfm]}
            components={{
              pre(props) {
                const { children, ...rest } = props;
                return (
                  <pre {...rest} className={styles.codeMarkdown}>
                    {children}
                  </pre>
                );
              },
              table(props) {
                const { children, ...rest } = props;
                return (
                  <table {...rest} className={styles.markdownTable}>
                    {children}
                  </table>
                );
              },
              th(props) {
                const { children, ...rest } = props;
                return (
                  <th {...rest} className={styles.markdownTableCell}>
                    {children}
                  </th>
                );
              },
              td(props) {
                const { children, ...rest } = props;
                return (
                  <td {...rest} className={styles.markdownTableCell}>
                    {children}
                  </td>
                );
              },
            }}
          />
          <div className={styles.thumbsContainer}>
            {(selectedIcon === 1 || selectedIcon === null) && (
              <Button
                variant="icon"
                iconName={selectedIcon === 1 ? "thumbs-up-filled" : "thumbs-up"}
                onClick={() => {
                  // props.onThumbsUp();
                  // const id = addNotification("success","Thank you for your valuable feedback!")
                  // Utils.delay(3000).then(() => removeNotification(id));
                  setSelectedIcon(1);
                  setModalVisible(true);
                }}
              />
            )}
            {(selectedIcon === 0 || selectedIcon === null) && (
              <Button
                iconName={
                  selectedIcon === 0 ? "thumbs-down-filled" : "thumbs-down"
                }
                variant="icon"
                onClick={() => {
                  // props.onThumbsDown(selectedIssue || "", selectedRankValue, feedbackMessage.trim());
                  // User clicked on thumbs down button, set state to thumbs down button
                  setSelectedIcon(0);
                  setModalVisible(true);
                }}
              />
            )}
          </div>
          {isAdmin && (<ReactMarkdown
            children={formatUserFeedback(props.message)}
            remarkPlugins={[remarkGfm]}
            components={{
              pre(props) {
                const { children, ...rest } = props;
                return (
                  <pre {...rest} className={styles.markdownContainer}>
                    {children}
                  </pre>
                );
              },
              table(props) {
                const { children, ...rest } = props;
                return (
                  <table {...rest} className={styles.markdownTable}>
                    {children}
                  </table>
                );
              },
              th(props) {
                const { children, ...rest } = props;
                return (
                  <th {...rest} className={styles.markdownTableCell}>
                    {children}
                  </th>
                );
              },
              td(props) {
                const { children, ...rest } = props;
                return (
                  <td {...rest} className={styles.markdownTableCell}>
                    {children}
                  </td>
                );
              },
            }}
          />)}
        </Container>
      )}
      {loading && (
        <Box float="left">
          <Spinner />
        </Box>
      )}      
      {props.message?.type === ChatBotMessageType.Human && (
        <TextContent>
          <strong>{props.message.content}</strong>
        </TextContent>
      )}
    </div>
  );
}