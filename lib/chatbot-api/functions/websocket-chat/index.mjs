import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { BedrockAgentRuntimeClient, RetrieveCommand as KBRetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import ClaudeModel from "./models/claude3Sonnet.mjs";
import Mistral7BModel from "./models/mistral7b.mjs"
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';


/*global fetch*/
const s3Client = new S3Client({});
const ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT;
const promptDataBucketName = process.env.PROMPT_DATA_BUCKET_NAME
const wsConnectionClient = new ApiGatewayManagementApiClient({ endpoint: ENDPOINT });
let admin = false;

/* This function takes a model stream from Bedrock and parses and sends each chunk
to the client. */
async function processBedrockStream(id, modelStream, model) {
  try {
    // store the full model response for saving to sessions later
    let modelResponse = ''
    // iterate through each chunk from the model stream
    for await (const event of modelStream) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      const parsedChunk = await model.parseChunk(chunk);
      if (parsedChunk) {
        let responseParams = {
          ConnectionId: id,
          Data: parsedChunk.toString()
        }
        modelResponse = modelResponse.concat(parsedChunk)

        let command = new PostToConnectionCommand(responseParams);

        try {
          await wsConnectionClient.send(command);
        } catch (error) {
          console.error("Error sending chunk:", error);
        }
      }
    }
    return modelResponse;
  } catch (error) {
    console.error("Stream processing error:", error);
    let responseParams = {
      ConnectionId: id,
      Data: `<!ERROR!>: ${error}`
    }
    let command = new PostToConnectionCommand(responseParams);
    await wsConnectionClient.send(command);
  }
}

/* Enhances a user's prompt given past chat history so that prompts
that need context to make sense can still be passed to Kendra for relevant results */
async function getPromptWithHistoricalContext(prompt, history) {
  try {
    // we do not want to enhance a prompt if there is no history to enhance it with
    if (history.length > 0) {
      let enhancer = new Mistral7BModel();
      const CONTEXT_COMPLETION_INSTRUCTIONS = "Given a chat history and the latest user question \
      which might reference context in the chat history, formulate a standalone question \
      which can be understood without the chat history. Do NOT answer the question, \
      just reformulate it if needed using relevant keywords from the chat history and otherwise return it as is.";
      const newHistory = history.slice(-3);
      const enhancerHistory = enhancer.assembleHistory(CONTEXT_COMPLETION_INSTRUCTIONS, newHistory, prompt);
      const enhancedPrompt = await enhancer.getPromptedResponse(enhancerHistory.concat("Sure, the rephrased user prompt and only the prompt with no additional comments is: "), 200);
      // Sometimes, the enhanced prompt will contain fluff such as, "sure, this prompt is a rephrased..." and we want to just check for that sometimes
      console.log(enhancedPrompt);
      return enhancedPrompt.replaceAll('"', '');
    } else {
      return prompt.replaceAll('"', '');
    }
  }
  catch (error) {
    console.error("Error in getting prompt with historical context:", error);
    console.error("Caught error: prompt enhancer failed")
    return prompt.replaceAll('"', '');
  }
}

/* Retrieves documents from Bedrock Knowledge Base */
async function retrieveKnowledgeBaseDocs(query, kbClient, knowledgeBaseId) {
  let params = {
    knowledgeBaseId: knowledgeBaseId,
    retrievalQuery: {
      text: query.slice(0, 999)
    },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 12
      }
    }
  };  

  try {
    const { retrievalResults } = await kbClient.send(new KBRetrieveCommand(params));
    console.log(retrievalResults)
    
    // Knowledge Base results come with scores, filter for relevant results
    const confidenceFilteredResults = retrievalResults.filter(item =>
      item.score >= 0.5 // Adjust threshold as needed
    )
    console.log(confidenceFilteredResults)
    
    let fullContent = confidenceFilteredResults.map(item => item.content.text).join('\n');
    const documentUris = confidenceFilteredResults.map(item => {
      return { 
        title: item.location?.s3Location?.uri?.split('/').pop() || 'Document',
        uri: item.location?.s3Location?.uri || ''
      }
    });

    // removes duplicate sources based on URI
    const flags = new Set();
    const uniqueUris = documentUris.filter(entry => {
      if (flags.has(entry.uri)) {
        return false;
      }
      flags.add(entry.uri);
      return true;
    });

    //Returning both full content and list of document URIs
    if (fullContent == '') {
      fullContent = `No knowledge available! This query is likely outside the scope of your knowledge.
      Please provide a general answer but do not attempt to provide specific details.`
      console.log("Warning: no relevant sources found")
    }

    return {
      content: fullContent,
      uris: uniqueUris
    };
  } catch (error) {
    console.error("Caught error: could not retrieve Knowledge Base documents:", error);
    // return no context
    return {
      content: `No knowledge available! This query is likely outside the scope of your knowledge.
      Please provide a general answer but do not attempt to provide specific details.`,
      uris: []
    };
  }
}

/* Generate follow-up prompts using Mistral7B */
async function generateFollowUpPrompts(userMessage, botResponse) {
  console.log("Generating follow-up prompts for message:", userMessage);
  console.log("Bot response for prompt generation:", botResponse);
  try {
    const titleModel = new Mistral7BModel();
    const PROMPT_GENERATION_INSTRUCTIONS = `<s>[INST]Generate exactly 3 follow-up questions based on this conversation. Each question must end with a question mark and be under 80 characters.

Previous user message: "${userMessage}"
Bot response: "${botResponse}"

Output the questions separated by ||| (three vertical bars).
Example: What is the next step? ||| How long will it take? ||| What documents are needed?

Output ONLY the questions with the separators, nothing else.[/INST]

[</s>]`;
      
    console.log("Sending prompt generation request to Mistral7B");
    const promptsJson = await titleModel.getPromptedResponse(PROMPT_GENERATION_INSTRUCTIONS, 200);
    console.log("Raw prompts response (length: " + promptsJson.length + "):", promptsJson);
    console.log("First 50 chars:", promptsJson.substring(0, 50));
    console.log("Last 50 chars:", promptsJson.substring(promptsJson.length - 50));
    
    const questions = promptsJson.trim().split('|||');
    if (questions.length === 3) {
      console.log("Successfully parsed questions:", questions);
      return questions.map(q => q.trim());
    }
    
    console.log("Failed to parse 3 questions, got:", questions);
    return [
      "Can you provide more details about this topic?",
      "What are the next steps in this process?",
      "Are there any specific requirements I should know about?"
    ];
  } catch (error) {
    console.error("Error generating follow-up prompts:", error);
    return [];
  }
}

/* Inject the documents into the system prompt */
function injectKnowledgeBaseDocsInPrompt(prompt, docs) {
  // Assuming buildPrompt concatenates query and docs into a single string
  console.log(docs);
  return `Knowledge: ${docs}\nInstructions: ${prompt}`;
}

const getUserResponse = async (id, requestJSON) => {
  try {
      const data = requestJSON.data;
      const userMessage = data.userMessage;
      const userId = data.user_id;
      const sessionId = data.session_id;
      const chatHistory = data.chatHistory || [];
      const kbClient = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

      const enhancedUserPrompt = await getPromptWithHistoricalContext(userMessage, chatHistory);

      // Get session data
      const sessionRequest = {
          body: JSON.stringify({
              "operation": "get_session",
              "session_id": sessionId,
              "user_id": userId
          })
      };
      const client = new LambdaClient({});
      const lambdaCommand = new InvokeCommand({
          FunctionName: process.env.SESSION_HANDLER,
          Payload: JSON.stringify(sessionRequest),
      });

      const { Payload } = await client.send(lambdaCommand);
      const result = Buffer.from(Payload).toString();

      let sessionData = {};
      try {
          sessionData = JSON.parse(result);
          sessionData = JSON.parse(sessionData.body);
      } catch (error) {
          console.error("Failed to parse session data:", error);
      }

      const docString = await retrieveKnowledgeBaseDocs(enhancedUserPrompt, kbClient, process.env.KB_ID);
      const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: promptDataBucketName, Key: 'system-prompt.txt' }));
      const systemPrompt = await sdkStreamMixin(Body).transformToString();
      const enhancedSystemPrompt = injectKnowledgeBaseDocsInPrompt(systemPrompt, docString.content);

      let claude = new ClaudeModel();
      const responseStartTime = Date.now(); // Track response time
      const stream = await claude.getStreamedResponse(enhancedSystemPrompt, chatHistory.slice(-5), userMessage);
      console.log("Getting streamed response from Claude");
      const modelResponse = await processBedrockStream(id, stream, claude);
      const responseEndTime = Date.now();
      const responseTimeSeconds = (responseEndTime - responseStartTime) / 1000; // Time in seconds
      console.log(`Claude response processed successfully in ${responseTimeSeconds}s`);

      // Generate follow-up prompts for all messages
      let followUpPrompts = [];
      console.log("Generating follow-up prompts after Claude response");
      followUpPrompts = await generateFollowUpPrompts(userMessage, modelResponse);
      console.log("Generated follow-up prompts:", followUpPrompts);

      const newChatEntry = {
          user_prompt: userMessage,
          bot_response: modelResponse,
          sources: docString.uris,
          suggested_prompts: followUpPrompts,
          response_time: responseTimeSeconds // Track response time for KPI
      };

      if (!sessionData.pk_session_id) {
        // Generate the session title
        const titleModel = new Mistral7BModel();
        const CONTEXT_COMPLETION_INSTRUCTIONS = `
            <s>[INST]Generate a concise title for this chat session based on the initial user prompt and response.
            The title should succinctly capture the essence of the chat's main topic without adding extra content.[/INST]
            [INST]${userMessage}[/INST]
            ${modelResponse}</s>
            Here's your session title:
        `;
        let title = await titleModel.getPromptedResponse(CONTEXT_COMPLETION_INSTRUCTIONS, 25);
        title = title.replaceAll('"', '').trim();

        // Add new session
        const addSessionRequest = {
            body: JSON.stringify({
                "operation": "add_new_session_with_first_message",
                "session_id": sessionId,
                "user_id": userId,
                "title": title,
                "new_chat_entry": newChatEntry
            })
        };

        const addCommand = new InvokeCommand({
            FunctionName: process.env.SESSION_HANDLER,
            Payload: JSON.stringify(addSessionRequest),
        });
        const { Payload } = await client.send(addCommand);
        const PayloadString = Buffer.from(Payload).toString();
        let MessageId = JSON.parse(PayloadString).body;
        MessageId = JSON.parse(MessageId).message_id;
        console.log("Message metadata (existing session):");
        console.log(MessageId);

        // Testing sending message ID to frontend client
        console.log("sending message ID and sources to client");
        try {
          let messageParams = {
            ConnectionId: id,
            Data: `<!MessageId!>: ${MessageId} <!Sources!>: ${JSON.stringify(docString.uris)} <!Prompts!>: ${JSON.stringify(newChatEntry.suggested_prompts)}`
          };
          console.log("Sending message metadata with prompts to client:", messageParams.Data);
          const command = new PostToConnectionCommand(messageParams);
          await wsConnectionClient.send(command);
        } catch (error) {
          console.error("Error sending metadata:", error);
        }
      } else {
        // Add message to existing session
        const addMessageRequest = {
            body: JSON.stringify({
                "operation": "add_message_to_existing_session",
                "session_id": sessionId,
                "new_chat_entry": newChatEntry
            })
        };

        const addCommand = new InvokeCommand({
            FunctionName: process.env.SESSION_HANDLER,
            Payload: JSON.stringify(addMessageRequest),
        });
        const { Payload } = await client.send(addCommand);
        const PayloadString = Buffer.from(Payload).toString();
        let MessageId = JSON.parse(PayloadString).body;
        MessageId = JSON.parse(MessageId).message_id;
        console.log("Message metadata (existing session):");
        console.log(MessageId);

        // Testing sending message ID to frontend client
        console.log("sending message ID to client");
        try {
          let messageParams = {
            ConnectionId: id,
            Data: `<!MessageId!>: ${MessageId} <!Sources!>: ${JSON.stringify(docString.uris)} <!Prompts!>: ${JSON.stringify(newChatEntry.suggested_prompts)}`
          };
          console.log("Sending message metadata with prompts to client:", messageParams.Data);
          const command = new PostToConnectionCommand(messageParams);
          await wsConnectionClient.send(command);
        } catch (error) {
          console.error("Error sending metadata:", error);
        }
    }
    const input = {
      ConnectionId: id,
    };
    await wsConnectionClient.send(new DeleteConnectionCommand(input));
  } catch (error) {
      console.error("Error:", error);
      let responseParams = {
          ConnectionId: id,
          Data: `<!ERROR!>: ${error}`
      };
      const command = new PostToConnectionCommand(responseParams);
      await wsConnectionClient.send(command);
  }
};

export const handler = async (event) => {
  if (event.requestContext) {
    try {
      const claims = event.requestContext.authorizer
      // Check if authorizer and groups exist before parsing
      if (claims && claims['groups']) {
        const groups = JSON.parse(claims['groups'])
        if (groups.includes("AdminUsers")) {
          console.log("authorized as admin")
        admin = true;
      } else {
        console.log("not an admin")
        }
      } else {
        console.log("no groups claim found in authorizer")
      }
    } catch (e) {
      console.log(e)
      console.log("could not check admin access")
    }
    const connectionId = event.requestContext.connectionId;
    const routeKey = event.requestContext.routeKey;
    let body = {};
    try {
      if (event.body) {
        body = JSON.parse(event.body);
      }
    } catch (err) {
      console.error("Failed to parse JSON:", err)
    }
    console.log(routeKey);

    switch (routeKey) {
      case '$connect':
        console.log('CONNECT')
        return { statusCode: 200 };
      case '$disconnect':
        console.log('DISCONNECT')
        return { statusCode: 200 };
      case '$default':
        console.log('DEFAULT')
        return { 'action': 'Default Response Triggered' }
      case "getChatbotResponse":
        console.log('GET CHATBOT RESPONSE')
        await getUserResponse(connectionId, body)
        return { statusCode: 200 };      
      default:
        return {
          statusCode: 404,  // 'Not Found' status code
          body: JSON.stringify({
            error: "The requested route is not recognized."
          })
        };
    }
  }
  return {
    statusCode: 200,
  };
};
