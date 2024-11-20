import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";

export default function Playground() {
  const { sessionId } = useParams();

  return (    
    <BaseAppLayout
      info={
        <HelpPanel header={<Header variant="h3">Using BidBot</Header>}>
          <p>
          BidBot is a tool you can use to draft better procurements and determine how to proceed in the procurement process. You can write anything you would ask a procurement official, but be sure to <b>talk with a procurement official before releasing any procurement vehicles or if you have any questions about your work.</b> During the pilot of BidBot, all responses will be recorded for review by the Procurement team to ensure the tool is performing as expected.
          </p>
          <h3>When to Use BidBot</h3>
          <p>
            <b>Procurement Questions:</b> Ask BidBot about procurement rules, options, best practices, or how to get started with a procurement process. <br>
            <i>Example: "How should I buy cups for an event?"</i><br>
            <b>Writing Solicitations:</b> Use BidBot to draft RFPs, RFQs, WQCs, and other solicitation documents tailored to your needs. <br>
            <i>Example: "Write me an RFP for a tree-cutting service."</i><br>
          </p>
          <h3>When Not to Use BidBot</h3>
          <p>
          <b>Evaluation of Proposals:</b> BidBot is not designed to evaluate vendor proposals or assist in making selection decisions. Use your team's established evaluation criteria and processes instead of BidBot.
          </p>
          <h3>How to Use BidBot</h3>
          <p>
          <b>Send a Message:</b> Click the box at the bottom of the window that says "Send a message", and type your question or request— like <i>"I want to buy new water bottles, what should I do?"</i> or <i>"Write me an RFP for a contractor who will cut trees"</i>— then press the <b>send button</b>. You can ask anything procurement-related, and don’t worry— you won’t break the tool!
          </p>
          <p>
          <b>Responding to BidBot:</b> After BidBot replies, you can continue the conversation like you would in a text chat. For example, you might ask, <i>"How do I write a requisition? Can you create one for me?" </i> and send it the same way as your first message— by clicking into the "Send a message" box, typing your message, and clicking the blue send button.
          </p>
          <h3>What You Can Do with BidBot’s Responses</h3>
          <p>
          <b>Copy a Response:</b> If BidBot gives you something you'd like to copy—such as an RFP, RFQ, WQC, or a Scope of Work—just click the <b>copy button</b> at the top right corner of the response.
          </p>
          <p>
          <b>View Sources BidBot Used:</b> To see where BidBot got its information, click the <b>“Sources” button</b> below the response. This can be helpful if you want to provide additional context when checking with Procurement.
          </p>
          <p>
          <b>Provide Feedback:</b> If BidBot's answer was helpful or unhelpful, or if you want to tell us something about the tool in general, you can use the <b>thumbs up or thumbs down buttons</b> in the bottom left corner of the response. You can also include a message to let us know why you rated BidBot the way you did.
          </p>

          <h3>Returning to and Managing Conversations</h3>
          <p>
          <b>Viewing Past Conversations:</b> To view your past conversations, click the <b>circle with three lines</b> in the top left corner of the screen. A list of your previous sessions will appear. While you can keep the same conversation going for as long as you’d like, we recommend starting a <b>new session</b> when you switch topics or projects. To do this, click the <b>New session button</b> above the list of past conversations.
          </p>
          <p>
          <b>Resuming a Conversation:</b> To pick up a past conversation, just click one of the <b>titles from the list</b>. This will take you back to where you left off in that conversation.
          </p>
          <p>
          <b>Closing the List of Sessions:</b> If you want to hide the list of sessions, <b>click the back arrow</b> next to the New session button. This will close the list, but you can still send messages to BidBot while the session list is open.
          </p>
          <h3>Additional Options and Help</h3>
          <p>
          <b>Help Reminder:</b> If you need to review these instructions, simply click the <b>“i” button</b> in the top right corner of the screen.
          </p>
          <p>
          <b>Dark Mode:</b> To switch to a dark background for easier reading, click <b>“Dark Mode”</b> in the top right corner of the screen above the “i” button.
          </p>
          <p>
          <b>Signing Out:</b> If you’d like to sign out, click the <b>person icon</b> located above the “i” button in the top right corner.
          </p><br>
          
          <p>If you have any questions or feedback about BidBot, please leave feedback in the tool or reach out to Maia Materman (maia.materman@boston.gov). </p> 
          
          <p> Happy Procuring!</p>

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
