# DynamoDB Schema

## 1. Chat Sessions Table (`chat_sessions`)

**Primary Key**: `pk_session_id`

### Attributes
- `pk_session_id` (String, Partition Key): Unique identifier for each session.
- `user_id` (String): Identifier of the user who initiated the session.
- `title` (String): Descriptive title for the session.
- `created_at` (String, ISO Timestamp): The earliest time when the first message was sent.
- `updated_at` (String, ISO Timestamp): The latest time a message was sent or a response was generated.
- `message_count` (Number): The number of messages within the session.

### Indexes
- **GSI on `user_id`**
  - Partition Key: `user_id`
  - Sort Key: `created_at` (for sorting sessions by creation date)
- **Optional GSI on `title`**
  - Partition Key: `title`

---

## 2. Messages Table (`messages`)

**Primary Key**: `pk_message_id`

**Sort Key**: `sk_session_id`

### Attributes
- `pk_message_id` (String, Partition Key): Unique identifier for each message.
- `sk_session_id` (String, Sort Key): Identifier of the session this message belongs to.
- `user_prompt` (String): The content of the prompt or question asked by the user.
- `bot_response` (String): The chatbot’s reply to the user prompt.
- `metadata` (Map): Complex object consisting of the referenced documents from Kendra index in order of relevance.
- `sent_at` (String, ISO Timestamp): The timestamp when the user prompt was sent.
- `response_time` (Number): Time in seconds it took for the response to generate.
- `errors` (String, Optional): Any errors encountered during message generation.
- **Feedback Attributes**:
  - `feedback_type` (String): Indicates positive or negative feedback.
  - `feedback_rank` (Number): Satisfaction rating from 1-5.
  - `feedback_category` (String): Category or reason for feedback.
  - `feedback_message` (String, Optional): Additional details from user feedback.
  - `feedback_created_at` (String, ISO Timestamp): Timestamp of when feedback was submitted.

### Indexes
- **GSI on `sk_session_id`**
  - Partition Key: `sk_session_id`
  - Sort Key: `created_at` (for sorting messages by timestamp within a session)
- **Optional GSI on Feedback Attributes (e.g., `feedback_type`)** for filtering messages based on feedback.

---

## 3. Reviews Table (`reviews`)

**Primary Key**: `pk_review_id`

### Attributes
- `pk_review_id` (String, Partition Key): Unique identifier for each review.
- `session_id` (String): Identifier of the session the review belongs to.
- `reviewed_by` (String): User ID of the admin who reviewed the session.
- `comments` (String, Optional): Review comments or notes.
- `reviewed_at` (String, ISO Timestamp): Timestamp when the review was archived.

### Indexes
- **GSI on `session_id`**
  - Partition Key: `session_id` (for retrieving reviews based on session ID)
- **Optional GSI on `has_archived` and `reviewed_by`** for filtering reviews by archival status and reviewer.