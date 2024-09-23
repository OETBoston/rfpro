import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";

export default function Playground() {
  const { sessionId } = useParams();

  return (    
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using the chat</Header>}>
          <p>
            This is a customizable chatbot application capable of both answering general questions
            as well as referencing custom documents in order to fit a specific business use-case.
          </p>
          <h3>Feedback</h3>
          <p>
            You can submit feedback on every response. Negative feedback will consist of a category (depends on the use-case of the chatbot),
            a type of issue, and some written comments. Admin users can view all feedback on a dedicated
            page. Sources (if part of the original response) will be included with the feedback submission.
          </p>
          <h3>Sources</h3>
          <p>
            If the chatbot references any files (uploaded by admin users), they will show up
            underneath the relevant message. Admin users have access to a portal to add or delete
            files. 
          </p>
          <h3>Session history</h3>
          <p>
            All conversations are saved and can be later accessed via {" "}
            <Link to="/chatbot/sessions">Sessions</Link>.
          </p>
        </HelpPanel>
      }
      toolsWidth={300}       
      content={
       <div>
      {/* <Chat sessionId={sessionId} /> */}
      
      <Chat sessionId={sessionId} />
      </div>
     }
    />    
  );
}
