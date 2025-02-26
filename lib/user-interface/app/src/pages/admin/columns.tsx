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

/** This is exposed as a function because the code that this is based off of
 * originally supported many more distinct file types.
 */
export function getColumnDefinition(documentType: AdminDataType) {
  switch (documentType) {
    case "file":
      return FILES_COLUMN_DEFINITIONS;   
    case "feedback":
      return FEEDBACK_COLUMN_DEFINITIONS;
    case "session":
      return SESSION_COLUMN_DEFINITIONS;
    default:
      return [];
  }
}
