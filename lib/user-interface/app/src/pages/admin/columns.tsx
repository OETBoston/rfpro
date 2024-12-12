import { AdminDataType } from "../../common/types";
import { DateTime } from "luxon";
import { Utils } from "../../common/utils";

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
    cell: (item) => item.FeedbackType,
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

/** This is exposed as a function because the code that this is based off of
 * originally supported many more distinct file types.
 */
export function getColumnDefinition(documentType: AdminDataType) {
  switch (documentType) {
    case "file":
      return FILES_COLUMN_DEFINITIONS;   
    case "feedback":
      return FEEDBACK_COLUMN_DEFINITIONS;
    default:
      return [];
  }
}
