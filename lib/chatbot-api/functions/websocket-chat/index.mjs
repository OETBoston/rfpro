import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { KendraClient, RetrieveCommand } from "@aws-sdk/client-kendra";
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

/* Retrieves documents from a Kendra index */
async function retrieveKendraDocs(query, kendra, kendraIndex) {
  let params = {
    QueryText: query.slice(0, 999),
    IndexId: kendraIndex,
    PageSize: 12,
    PageNumber: 1,
    SortingConfiguration: {
      DocumentAttributeKey: '_last_updated_at', // Using the built-in attribute for last updated timestamp
      SortOrder: 'DESC' // Ensure latest documents come first
    }
  };  

  try {
    const { ResultItems } = await kendra.send(new RetrieveCommand(params));
    console.log(ResultItems)
    // filter the items based on confidence, we do not want LOW confidence results
    const confidenceFilteredResults = ResultItems.filter(item =>
      item.ScoreAttributes.ScoreConfidence == "VERY_HIGH"
      || item.ScoreAttributes.ScoreConfidence == "HIGH"
      || item.ScoreAttributes.ScoreConfidence == "MEDIUM"
    )
    console.log(confidenceFilteredResults)
    let fullContent = confidenceFilteredResults.map(item => item.Content).join('\n');
    const documentUris = confidenceFilteredResults.map(item => {
      return { title: item.DocumentTitle, uri: item.DocumentURI }
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

    // console.log(fullContent);

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
    console.error("Caught error: could not retreive Kendra documents:", error);
    // return no context
    return {
      content: `No knowledge available! This query is likely outside the scope of the RIDE.
      Please provide a general answer but do not attempt to provide specific details.`,
      uris: []
    };
  }
}

/* Inject the documents into the system prompt */
function injectKendraDocsInPrompt(prompt, docs) {
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
      const kendra = new KendraClient({ region: 'us-east-1' });

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
      } catch (error) {
          console.error("Failed to parse session data:", error);
      }

      const docString = await retrieveKendraDocs(enhancedUserPrompt, kendra, process.env.INDEX_ID);
      const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: promptDataBucketName, Key: 'system-prompt.txt' }));
      const systemPrompt = await sdkStreamMixin(Body).transformToString();
      const enhancedSystemPrompt = injectKendraDocsInPrompt(systemPrompt, docString.content);

      let claude = new ClaudeModel();
      const stream = await claude.getStreamedResponse(enhancedSystemPrompt, chatHistory.slice(-5), userMessage);
      const modelResponse = await processBedrockStream(id, stream, claude);

      const newChatEntry = {
          user_prompt: userMessage,
          bot_response: modelResponse,
          sources: docString.uris
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
        await client.send(addCommand);
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
        await client.send(addCommand);
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
      const roles = JSON.parse(claims['role'])
      if (roles.includes("Admin")) {
        console.log("authorized")
        admin = true;
      } else {
        console.log("not an admin")
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
