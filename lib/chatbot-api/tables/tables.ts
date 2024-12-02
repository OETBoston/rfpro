import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttributeType, Table, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';


// NOTE: Cloudformation has a 1 at a time cap on adding or removings GSIs
// Only recommend to do so if performance has been significantly impacted.
// https://github.com/aws/aws-cdk/issues/12246
// https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/229
export class TableStack extends Stack {
  public readonly sessionsTable: Table;
  public readonly messagesTable: Table;
  public readonly reviewsTable: Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define the Chat Sessions Table
    const sessionsTable = new Table(this, 'ChatSessionsTable', {
      tableName: "ChatSessionsTable",
      partitionKey: { name: 'pk_session_id', type: AttributeType.STRING },
    });

    // Add a global secondary index to query sessions by user_id and sort by created_at
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserSessionsIndex',
      partitionKey: { name: 'user_id', type: AttributeType.STRING },
      sortKey: { name: 'created_at', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // // Optional GSI on title for filtering sessions by title
    // sessionsTable.addGlobalSecondaryIndex({
    //   indexName: 'TitleIndex',
    //   partitionKey: { name: 'title', type: AttributeType.STRING },
    //   projectionType: ProjectionType.ALL,
    // });

    this.sessionsTable = sessionsTable;

    // Define the Messages Table
    const messagesTable = new Table(this, 'ChatMessagesTable', {
      tableName: "ChatMessagesTable",
      partitionKey: { name: 'pk_message_id', type: AttributeType.STRING },
      sortKey: { name: 'sk_session_id', type: AttributeType.STRING },
    });

    // Add GSI for retrieving messages by session with sort key on created_at
    messagesTable.addGlobalSecondaryIndex({
      indexName: 'SessionMessagesIndex',
      partitionKey: { name: 'sk_session_id', type: AttributeType.STRING },
      sortKey: { name: 'created_at', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // // Optional GSI for filtering messages based on feedback attributes (e.g., feedback_type)
    // messagesTable.addGlobalSecondaryIndex({
    //   indexName: 'FeedbackTypeIndex',
    //   partitionKey: { name: 'feedback_type', type: AttributeType.STRING },
    //   projectionType: ProjectionType.ALL,
    // });

    this.messagesTable = messagesTable;

    // Define the Reviews Table
    const reviewsTable = new Table(this, 'ChatReviewsTable', {
      tableName: "ChatReviewsTable",
      partitionKey: { name: 'pk_review_id', type: AttributeType.STRING },
    });

    // GSI to retrieve reviews based on session_id
    reviewsTable.addGlobalSecondaryIndex({
      indexName: 'SessionReviewIndex',
      partitionKey: { name: 'session_id', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    // // Optional GSI for filtering reviews by archival status and reviewer
    // reviewsTable.addGlobalSecondaryIndex({
    //   indexName: 'ReviewerIndex',
    //   partitionKey: { name: 'reviewed_by', type: AttributeType.STRING },
    //   projectionType: ProjectionType.ALL,
    // });

    this.reviewsTable = reviewsTable;
  }
}