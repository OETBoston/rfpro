import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Alert
} from "@cloudscape-design/components";
import {
  Authenticator,
  Heading,
  useTheme,
} from "@aws-amplify/ui-react";
import BaseAppLayout from "../../components/base-app-layout";
import useOnFollow from "../../common/hooks/use-on-follow";
import FeedbackTab from "./feedback-tab";
import FeedbackPanel from "../../components/feedback-panel";
import { CHATBOT_NAME } from "../../common/constants";
import { useState, useEffect } from "react";
import { Auth } from "aws-amplify";
import { useAdmin } from "../../common/admin-context";


export default function UserFeedbackPage() {
  const isAdmin = useAdmin();
  const onFollow = useOnFollow();  
  const [feedback, setFeedback] = useState<any>({});

  /** If they are not an admin, show a page indicating so */
  if (!isAdmin) {
    return (
      <div
        style={{
          height: "90vh",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Alert header="Configuration error" type="error">
          You are not authorized to view this page!
        </Alert>
      </div>
    );
  }

  return (    
    <BaseAppLayout
      contentType="cards"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },

            {
              text: "View Feedback",
              href: "/admin/user-feedback",
            },
          ]}
        />
      }
      splitPanel={<FeedbackPanel selectedFeedback={feedback}/>}
      content={
        <ContentLayout header={<Header variant="h1">View Feedback</Header>}>
          <SpaceBetween size="l">
                <FeedbackTab updateSelectedFeedback={setFeedback}/>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
