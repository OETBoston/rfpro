# AWS API Gateway Overview

This documentation provides an overview of the HTTP and WebSocket API gateways defined in the project. The gateways are integral for routing requests to backend resources, including Lambda functions, DynamoDB, and other AWS services.

---

## 1. **REST API Gateway (`RestBackendAPI`)**

### Description
The REST API Gateway is implemented to handle HTTP requests and route them to various backend services. It supports CORS and integrates with multiple AWS resources for scalable and secure API handling.

### Key Features
- **CORS Configuration**:
  - Allows all headers (`*`).
  - Supports HTTP methods: `GET`, `POST`, `DELETE`, `HEAD`, and `OPTIONS`.
  - Allows all origins (`*`) for cross-origin requests.
  - Preflight requests are cached for up to 10 days.
- **Backend Integration**:
  - Routes requests to Lambda functions, DynamoDB, S3, and other AWS services as needed.
  - Can integrate with AppSync for GraphQL queries when extended.
- **Custom Permissions**:
  - Grants read/write or invoke permissions for various AWS resources, including Kendra, SageMaker, and OpenSearch, based on the specific backend service being used.

### AWS Services Integration
- **Lambda**: Processes requests routed from API Gateway.
- **DynamoDB**: Stores application data accessed through the API.
- **S3**: Manages object storage for user uploads and other resources.
- **Kendra**: Provides advanced search capabilities for API endpoints.
- **SageMaker**: Invokes ML endpoints for inference tasks.
- **OpenSearch**: Supports search queries for indexed data.

---

## 2. **WebSocket API Gateway (`WebsocketBackendAPI`)**

### Description
The WebSocket API Gateway is designed for real-time, two-way communication between clients and the backend. It is ideal for use cases such as messaging systems or live updates.

### Key Features
- **WebSocket API**:
  - Provides a persistent connection for real-time data exchange.
  - Supports dynamic routing of messages to backend services.
- **Stages**:
  - A production stage (`prod`) is defined with auto-deploy enabled for seamless updates.
- **Scalability**:
  - Automatically scales based on the number of active connections.

### AWS Services Integration
- **Message Bus**: Can integrate with SNS, SQS, or custom messaging services for real-time communication.
- **DynamoDB**: Can store session or connection details for managing WebSocket connections.

---

## Shared Features Across Gateways

### 1. **Security**
- **IAM Policies**:
  - Fine-grained permissions are defined to limit access to AWS resources.
  - Supports AssumeRole for cross-account access.
- **Tracing**:
  - Integrated with AWS X-Ray for monitoring and debugging.

### 2. **Error Handling**
- Graceful error responses with status codes and error messages.
- Integrated logging via AWS CloudWatch.

### 3. **CORS Support**
- Configured to allow all origins and headers for development convenience.
- Preflight requests are cached for performance optimization.

### 4. **Extensibility**
- The gateways are designed to integrate with additional AWS services like AppSync, OpenSearch, and SageMaker for advanced use cases.

---

## Notes

- The **REST API Gateway** and **WebSocket API Gateway** are independent but can be combined for hybrid use cases.
- Ensure that the required environment variables are configured before deploying the stack.
- Use CloudWatch to monitor API usage and debug issues.
- For production, consider restricting CORS settings and tightening IAM policies for enhanced security.
