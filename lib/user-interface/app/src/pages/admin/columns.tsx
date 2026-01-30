import { AdminDataType } from "../../common/types";
import { DateTime } from "luxon";
import { Utils } from "../../common/utils";
import { Link } from "@cloudscape-design/components";
import TextContent from "@cloudscape-design/components/text-content";

const FILES_COLUMN_DEFINITIONS = [
  {
    id: "name",
    header: "Name",
    cell: (item) => item.Key!,
    isRowHeader: true,
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item) =>
      DateTime.fromISO(new Date(item.LastModified).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
  {
    id: "size",
    header: "Size",
    cell: (item) => Utils.bytesToSize(item.Size!),
  },
];

const FEEDBACK_COLUMN_DEFINITIONS = [
  {
    id: "createdAt",
    header: "DATE",
    cell: (item) =>
      DateTime.fromISO(new Date(item.CreatedAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
  {
    id: "feedbackType",
    header: "SENTIMENT",
    cell: (item) => <Link href={`/chatbot/playground/${item.SessionID}`} variant="secondary">{item.FeedbackType}</Link>,
    isRowHeader: true,
  },
  {
    id: "feedbackCategory",
    header: "CATEGORY",
    cell: (item) => item.FeedbackCategory,
    isRowHeader: true,
  },
  {
    id: "feedbackRank",
    header: "RATING",
    cell: (item) => item.FeedbackRank,
    isRowHeader: true,
  },
  {
    id: "feedbackComments",
    header: "USER COMMENT",
    cell: (item) => item.FeedbackComments,
    isRowHeader: true
  },

];

const SESSION_COLUMN_DEFINITIONS = [
  {
    id: "time_stamp",
    header: "DATE",
    sortingField: "time_stamp",
    cell: (item) =>
      item.has_review === "No"? 
        <strong> {DateTime.fromISO(new Date(item.time_stamp).toISOString()).toLocaleString(DateTime.DATETIME_SHORT)} </strong>:
        DateTime.fromISO(new Date(item.time_stamp).toISOString()).toLocaleString(DateTime.DATETIME_SHORT),
  },
  {
    id: "title",
    header: "TITLE",
    sortingField: "title",
    width: 600,
    minWidth: 200,
    // cell: (item) => item.FeedbackType,
    cell: (item) => item.has_review === "No"? 
      <strong> <Link href={`/chatbot/playground/${item.session_id}`}>{item.title}</Link></strong>:
      <Link href={`/chatbot/playground/${item.session_id}`}>{item.title}</Link>,
    isRowHeader: true,
  },
  {
    id: "has_feedback",
    header: "HAS FEEDBACK",
    sortingField: "has_feedback",
    cell: (item) => item.has_review === "No"?
      <strong> {item.has_feedback} </strong>:
      item.has_feedback,
    isRowHeader: true,
  },
];

const EVALUATION_SUMMARY_COLUMN_DEFINITIONS = [
  {
    id: "evaluation_name",
    header: "Evaluation Name",
    sortingField: "evaluation_name",
    cell: (item) => item.evaluation_name || item.EvaluationId || 'Unnamed Evaluation',
    isRowHeader: true,
    width: 300,
  },
  {
    id: "timestamp",
    header: "Date",
    sortingField: "Timestamp",
    cell: (item) => {
      const timestamp = item.Timestamp || item.timestamp;
      return timestamp ? 
        DateTime.fromISO(new Date(timestamp).toISOString()).toLocaleString(DateTime.DATETIME_SHORT) : 
        'N/A';
    },
  },
  {
    id: "total_questions",
    header: "Total Questions",
    sortingField: "total_questions",
    cell: (item) => item.total_questions || 0,
  },
  {
    id: "average_similarity",
    header: "Avg Similarity",
    sortingField: "average_similarity",
    cell: (item) => item.average_similarity !== undefined ? 
      item.average_similarity.toFixed(2) : 'N/A',
  },
  {
    id: "average_relevance",
    header: "Avg Relevance",
    sortingField: "average_relevance",
    cell: (item) => item.average_relevance !== undefined ? 
      item.average_relevance.toFixed(2) : 'N/A',
  },
  {
    id: "average_correctness",
    header: "Avg Correctness",
    sortingField: "average_correctness",
    cell: (item) => item.average_correctness !== undefined ? 
      item.average_correctness.toFixed(2) : 'N/A',
  },
];

const DETAILED_EVALUATION_COLUMN_DEFINITIONS = [
  {
    id: "question_id",
    header: "Question ID",
    sortingField: "question_id",
    cell: (item) => item.QuestionId || item.question_id || 'N/A',
    isRowHeader: true,
  },
  {
    id: "question",
    header: "Question",
    cell: (item) => {
      const question = item.Question || item.question || 'N/A';
      return (
        <TextContent>
          <div style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {question}
          </div>
        </TextContent>
      );
    },
    width: 400,
  },
  {
    id: "similarity_score",
    header: "Similarity",
    sortingField: "similarity_score",
    cell: (item) => {
      const score = item.similarity ?? item.SimilarityScore ?? item.similarity_score;
      // Show N/A only if not a number, negative, or greater than 1
      if (typeof score !== 'number' || score < 0 || score > 1) {
        return 'N/A';
      }
      return (score * 100).toFixed(2) + '%';
    },
  },
  {
    id: "relevance_score",
    header: "Relevance",
    sortingField: "relevance_score",
    cell: (item) => {
      const score = item.relevance ?? item.RelevanceScore ?? item.relevance_score;
      // Show N/A only if not a number, negative, or greater than 1
      if (typeof score !== 'number' || score < 0 || score > 1) {
        return 'N/A';
      }
      return (score * 100).toFixed(2) + '%';
    },
  },
  {
    id: "correctness_score",
    header: "Correctness",
    sortingField: "correctness_score",
    cell: (item) => {
      const score = item.correctness ?? item.CorrectnessScore ?? item.correctness_score;
      // Show N/A only if not a number, negative, or greater than 1
      if (typeof score !== 'number' || score < 0 || score > 1) {
        return 'N/A';
      }
      return (score * 100).toFixed(2) + '%';
    },
  },
];

/** This is exposed as a function because the code that this is based off of
 * originally supported many more distinct file types.
 * @param documentType - The type of document to get column definitions for
 * @param onClickCallback - Optional callback function for clickable cells (used by evaluation types)
 */
export function getColumnDefinition(documentType: AdminDataType, onClickCallback?: (item: any) => void) {
  switch (documentType) {
    case "file":
      return FILES_COLUMN_DEFINITIONS;   
    case "feedback":
      return FEEDBACK_COLUMN_DEFINITIONS;
    case "session":
      return SESSION_COLUMN_DEFINITIONS;
    case "evaluationSummary":
      // Map the callback into the cell renderer for clickable evaluation names
      return EVALUATION_SUMMARY_COLUMN_DEFINITIONS.map(col => {
        if (col.id === "evaluation_name" && onClickCallback) {
          return {
            ...col,
            cell: (item) => {
              const name = item.evaluation_name || item.EvaluationId || 'Unnamed Evaluation';
              return (
                <Link onFollow={() => onClickCallback(item)} variant="primary">
                  {name}
                </Link>
              );
            }
          };
        }
        return col;
      });
    case "detailedEvaluation":
      return DETAILED_EVALUATION_COLUMN_DEFINITIONS;
    default:
      return [];
  }
}
