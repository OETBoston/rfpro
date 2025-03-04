import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Alert
} from "@cloudscape-design/components";
import BaseAppLayout from "../../components/base-app-layout";
import useOnFollow from "../../common/hooks/use-on-follow";
import AllSessionsTab from "./all-sessions-tab";
import { CHATBOT_NAME } from "../../common/constants";
import { useState, useEffect } from "react";
import { useAdmin } from "../../common/admin-context.js";
  
  
export default function AllSessionsPage() {
  const isAdmin = useAdmin();
  const onFollow = useOnFollow();  
  const [session, setSession] = useState<any>({});
  
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
              text: "All Sessions",
              href: "/admin/all-sessions",
            },
          ]}
        />
      }
      content={
        <ContentLayout header={<Header variant="h1">View All Sessions</Header>}>
          <SpaceBetween size="l">
                <AllSessionsTab updateSelectedSession={setSession}/>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
  