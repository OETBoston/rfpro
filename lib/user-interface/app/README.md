# AI for Impact x InnovateMA Program
## Background
This repository serves as a base chatbot application that uses AWS products. The following branches are customized applications built off the base project for agency-specific use cases.
- DOT
- MassHealth
- MBTA
- EEA

# To test local frontend development mode with deployed backend
Please add this file to the aws-exports.json folder in the `/lib/user-interface/app/public` directory:
```
{
    "Auth": {
      "region": "us-east-1",
      "userPoolId": [INSERT_USER_POOL_ID_HERE],
      "userPoolWebClientId": [INSERT_USER_POOL_WEB_CLIENT_ID_HERE],
      "oauth": {
        "domain": [INSERT_COGNITO_DOMAIN_HERE],
        "scope": [
          "aws.cognito.signin.user.admin",
          "email",
          "openid",
          "profile"
        ],
        "redirectSignIn": "http://localhost:3000",
        "redirectSignOut": "[NOT_IMPORTANT_CAN_USE_PROD_SIGNOUT_LINK]",
        "responseType": "code"
      }
    },
    "httpEndpoint": "https://xxxxxx.execute-api.us-east-1.amazonaws.com/",
    "wsEndpoint": "wss://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod",
    "federatedSignInProvider": [INSERT_FEDERATED_SIGN_IN_PROVIDER_NAME],
    "config": {
      "api_endpoint": "https://xxxxxx.execute-api.us-east-1.amazonaws.com/",
      "websocket_endpoint": "wss://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod",
      "rag_enabled": false
    }
  }
```
You may fetch the aws-exports.json file created in the cdk deployment from the s3 bucket,
but make sure to replace the redirectedSignIn in order to bypass oauth redirect to prod locally.

## Front-end
The front-end of the base application is located in this repository.
To edit the user interface explore the /src/components and /src/pages/chatbot folders.
Quick customizations:
- To change the logo swap out the logo.png file.
- /src/common/constants.ts change the name of the project on line 109.
- /src/components/chatbot/chat-input-panel.tsx customize the system prompt.

### Walkthrough Feature
The application includes an interactive walkthrough feature that guides new users through the chat interface:

**Features:**
- Interactive guided tour with step-by-step instructions
- Element highlighting with holes in overlay mask
- Conditional progression based on user interactions
- Configurable via YAML configuration file
- Fully accessible with keyboard navigation and screen reader support

**Usage:**
1. Click the "Take a Tour" button in the welcome text on new sessions
2. Follow the step-by-step guidance through the interface
3. Learn about prompt buttons, chat input, feedback system, and sources

**Configuration:**
- Edit `/public/walkthrough-config.yaml` to customize steps and content
- Add CSS classes to components for highlighting (e.g., `.prompt-buttons-container`)
- Modify `/src/components/walkthrough/` components for behavior changes

# AWS Tools Used
AWS Amplify
- Connects to Github repository (Super-Secret-Swag), agency specific branches
Cloudscape Design System
- Front-end components to be used with the AWS suite of products

## Back-end
The back-end code is a series of AWS lambda functions that serve as connectors between AWS services.

# AWS Tools 
AWS API GATEWAY (Websocket, REST, HTTP)
AWS Lambda
AWS Bedrock Knowledge Base with OpenSearch
AWS Bedrock
- Connects to Lambda
- Used for model access
AWS Cognito
S3
- Connects to Knowledge Base
- Used for knowledge management
DynamoDB
- Connects to Lambda
- Used for session history
