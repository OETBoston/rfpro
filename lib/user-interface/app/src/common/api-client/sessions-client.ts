import {
  ChatBotHistoryItem,
  ChatBotMessageType,
} from "../../components/chatbot/types";

import {
  Utils
} from "../utils"


import { AppConfig } from "../types";

export class SessionsClient {

  private readonly API;
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.slice(0, -1);
  }
  // Gets all sessions tied to a given user ID
  // Return format: [{"session_id" : "string", "user_id" : "string", "time_stamp" : "dd/mm/yy", "title" : "string"}...]
  async getSessions(
    userId: string,
    all?: boolean
  ) {
    const auth = await Utils.authenticate();
    let validData = false;
    let output = [];
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load sessions"
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify(all? { "operation": "list_all_sessions_by_user_id", "user_id": userId } : { "operation": "list_sessions_by_user_id", "user_id": userId })
      });
      if (response.status != 200) {
        validData = false;
        let jsonResponse = await response.json()        
        errorMessage = jsonResponse;        
        break;
      }      
      try {
        output = await response.json();
        validData = true;
      } catch (e) {
        // just retry, we get 3 attempts!
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage);
    }
    // console.log(output);
    return output;
  }

  // Returns a chat history given a specific user ID and session ID
  // Return format: ChatBotHistoryItem[]
  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<ChatBotHistoryItem[]> {
    const auth = await Utils.authenticate();
    let validData = false;
    let output;
    let responseUserId;       // Adding new properties to chathistory object 
    let responseTitle;        // Allows admin to see user ID, title, timestamp
    let responseCreatedAt;
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load session";

    /** Attempt to load a session up to 3 times or until it is validated */
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({
          "operation": "get_session", "session_id": sessionId,
          "user_id": userId
        })
      });
      /** Check for errors */
      if (response.status != 200) {
        validData = false;
        errorMessage = await response.json()
        break;
      }
      const reader = response.body.getReader();
      let received = new Uint8Array(0);

      /** Read the response stream */
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          let temp = new Uint8Array(received.length + value.length);
          temp.set(received);
          temp.set(value, received.length);
          received = temp;
        }
      }
      // Decode the complete data
      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(received);
      try {
        const decodedJson = JSON.parse(decoded);
        output = decodedJson.chat_history! as any[];
        responseUserId = decodedJson.user_id as string;
        responseTitle = decodedJson.title as string;
        responseCreatedAt = decodedJson.created_at as string;
        validData = true;
      } catch (e) {
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage)
    }
    let history: ChatBotHistoryItem[] = [];
    // console.log(output);
    if (output === undefined) {
      return history;
    }
    output.forEach(function (value) {
      let metadata = {}
      if (value.metadata) {
        metadata = { "Sources": JSON.parse(value.metadata) }
      }
      /** Add message ID to ChatBotHistoryItem so that the feedback 
       * handler Lambda function can add user feedback to message in DynamoDB.
       * Human and AI messages have same message ID. 
       * Add user feedback to chat history. API will return feedback if user is an admin
       * */
      history.push({
        type: ChatBotMessageType.Human,
        content: value.user,
        metadata: {},
        messageId: value.messageId,
        userFeedback: {},
        userId: responseUserId,
        title: responseTitle,
        createdAt: responseCreatedAt,
      },
      {
        type: ChatBotMessageType.AI,
        content: value.chatbot,
        metadata: metadata,
        messageId: value.messageId,
        userFeedback: value.userFeedback,
        userId: responseUserId,
        title: responseTitle,
        createdAt: responseCreatedAt,
      },)
    })
    return history;
  }

  /**Deletes a given session but this is not exposed in the UI */
  async deleteSession(
    sessionId: string,
    userId: string,
  ) {
    try {
      const auth = await Utils.authenticate();
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({
          "operation": "delete_session", "session_id": sessionId,
          "user_id": userId
        })
      });
    } catch {
      return "FAILED";
    }
    return "DONE";
  }

  // Gets all sessions for admin review
  // Return format: [{"session_id" : "string", "user_id" : "string", "time_stamp" : "dd/mm/yy", "title" : "string"}...]
  async getAllSessions(startTime: string, endTime: string, hasFeedback: string, hasReview: string, userId: string) {
    const auth = await Utils.authenticate();
    let validData = false;
    let output = [];
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load sessions"
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify({ 
          "operation": "list_all_sessions",
          "start_time": startTime,
          "end_time": endTime,
          "has_feedback": hasFeedback,
          "has_review": hasReview,
          "user_id": userId,
        })
      });
      if (response.status != 200) {
        validData = false;
        let jsonResponse = await response.json()        
        errorMessage = jsonResponse;        
        break;
      }      
      try {
        output = await response.json();
        validData = true;
      } catch (e) {
        // just retry, we get 3 attempts!
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage);
    }
    // console.log(output);
    return output;
  }

  // Creates, updates, or removes a review by an admin
  // Return format: [{"review_id": "string", "session_id" : "string", "user_id" : "string"]
  async updateReview(reviewId: string, sessionId: string, userId: string, update: boolean) {
    const auth = await Utils.authenticate();
    let validData = false;
    let output = [];
    let runs = 0;
    let limit = 3;
    let errorMessage = "Could not load sessions"
    while (!validData && runs < limit) {
      runs += 1;
      const response = await fetch(this.API + '/user-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + auth,
        },
        body: JSON.stringify(update ?
          {
            "operation": "update_review_session",
            "review_id": reviewId,
            "session_id": sessionId,
            "user_id": userId,
          } :
          {
            "operation": "delete_review_session",
            "review_id": reviewId,
            "session_id": sessionId,
            "user_id": userId,
          }
        )
      });
      if (response.status != 200) {
        validData = false;
        let jsonResponse = await response.json()        
        errorMessage = jsonResponse;        
        break;
      }      
      try {
        output = await response.json();
        validData = true;
      } catch (e) {
        // just retry, we get 3 attempts!
        console.log(e);
      }
    }
    if (!validData) {
      throw new Error(errorMessage);
    }
    // console.log(output);
    return output;
  }
}