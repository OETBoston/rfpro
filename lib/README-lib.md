# lib

The `lib` directory contains the core logic and infrastructure definitions for the application, structured to provide modularity and scalability. The architecture is designed to integrate seamlessly with AWS services, ensuring a robust, scalable, and secure solution. Below is a detailed overview of the components and how they interact with the AWS ecosystem.

## Directory Structure and Architecture

### Authorization (`authorization/`)
Handles authentication and user group management.

**Key Components:**
- **user-group-handler/**: Manages group membership and permissions, interacting with Amazon Cognito for user pool management.
- **websocket-api-authorizer/**: Implements authorization logic for WebSocket APIs, leveraging custom Lambda authorizers and Cognito.
- **README-auth.md**: Documentation for authorization components.
- **index.*:** Entry points for the authorization module.

**AWS Services:**
- **Amazon Cognito**: Manages user authentication and authorization.
- **IAM**: Enforces fine-grained permissions for resources.

---

### Chatbot API (`chatbot-api/`)
Encapsulates the chatbot's backend logic, integrating various AWS services for storage, search, and API handling.

**Subcomponents:**
1. **Buckets (`buckets/`)**:
   - Defines S3 buckets for storing chatbot-related data, feedback, and temporary files.
   - Supports secure file upload and download using presigned URLs.
2. **Functions (`functions/`)**:
   - Lambda functions handle API operations like processing feedback, interacting with DynamoDB, and generating presigned URLs for S3.
3. **Gateway (`gateway/`)**:
   - Configures API Gateway for routing HTTP and WebSocket requests to backend services.
4. **Kendra (`kendra/`)**:
   - Integrates with Amazon Kendra to provide intelligent search capabilities.
5. **Tables (`tables/`)**:
   - DynamoDB table definitions store chatbot session data, user feedback, and related metadata.
6. **index.*:** Entry points for the chatbot API.

**AWS Services:**
- **API Gateway**: Routes requests to Lambda functions.
- **Lambda**: Processes chatbot logic and backend interactions.
- **DynamoDB**: Stores structured data for sessions and feedback.
- **Amazon Kendra**: Powers advanced search capabilities for the chatbot.
- **S3**: Stores files and feedback exports.

---

### Shared Utilities (`shared/`)
Contains reusable utility functions for common operations.

**Key Components:**
- **utils.*:** Scripts and modules in TypeScript, JavaScript, and declaration formats for shared functionality.

**AWS Services:**
- None directly; supports other modules.

---

### User Interface (`user-interface/`)
Defines the user-facing elements of the application, including the website and frontend components.

**Key Components:**
- **app/**: Application code for the UI.
- **README-ui.md**: Documentation for the user interface.
- **generate-app.*:** Scripts for dynamic generation of application components.
- **index.*:** Entry points for the user interface module.

**Deployment and Architecture:**
- **AWS Amplify**: Used to connect the UI to Amazon Cognito for authentication.
- **S3**: Hosts the static files for the UI.
- **CloudFront**: Distributes the UI globally via a Content Delivery Network (CDN), ensuring low latency and high availability.
- **CORS Configuration**: Supports secure cross-origin resource sharing for API interactions.

---

### API Gateways
The application uses two API Gateway configurations for managing HTTP and WebSocket requests:
1. **REST API Gateway**:
   - Handles standard HTTP requests routed to Lambda functions or other AWS resources.
   - Integrates with DynamoDB, S3, and Amazon Kendra.
2. **WebSocket API Gateway**:
   - Provides persistent connections for real-time, two-way communication.
   - Ideal for chat messaging or live updates.

---

### Other Files
- **README-lib.md**: This documentation file for the `lib` directory.
- **cdk-rag-app-stack.*:** Infrastructure definitions for the application stack using AWS CDK.

---

## Notes
- The architecture leverages **AWS CDK** for infrastructure as code, ensuring consistent and repeatable deployments.
- Each module is designed to integrate seamlessly with AWS services for scalability, reliability, and security.
- **CORS Settings**: Configured for development but should be restricted in production.

---

## Subfiles Documentation

1. **Authorization**
   - [Authorization README](./authorization/README-auth.md)

2. **Chatbot API**
   - [Chatbot API README](./chatbot-api/README-chatbot-api.md)
   - Subcomponents:
     - [Buckets README](./chatbot-api/buckets/README-s3.md)
     - [Functions README](./chatbot-api/functions/README-lambda.md)
     - [Gateway README](./chatbot-api/gateway/README-api.md)
     - [Kendra README](./chatbot-api/kendra/README-kendra.md)
     - [Tables README](./chatbot-api/tables/README-tables.md)

3. **Shared Utilities**
   - [Shared Utilities README](./shared/README-shared.md)

4. **User Interface**
   - [User Interface README](./user-interface/README-ui.md)

Please refer to the individual READMEs for detailed information about each component.