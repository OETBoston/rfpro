import {
  Box,
  SpaceBetween,
  Table,
  DateRangePicker,
  Pagination,
  Button,
  Header,
  Modal,
  Select,
  DateRangePickerProps,
  CollectionPreferences,
} from "@cloudscape-design/components";
import { Auth } from "aws-amplify";
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.all';
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { getColumnDefinition } from "./columns";
import { Utils } from "../../common/utils";
import { useCollection } from "@cloudscape-design/collection-hooks";
import React from 'react';
import { useNotifications } from "../../components/notif-manager";

export interface AllSessionsTabProps {
  updateSelectedSession: React.Dispatch<any>;
}

export default function AllSessionsTab(props: AllSessionsTabProps) {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [showModalDelete, setShowModalDelete] = useState(false);
  const needsRefresh = useRef<boolean>(false);

  const [
    selectedOption,
    setSelectedOption
  ] = React.useState({ label: "All Feedback", value: "any" });
  const [
    hasReviewed,
    setHasReviewed
  ] = React.useState({ label: "All Reviews", value: "any" });
  const [value, setValue] = React.useState<DateRangePickerProps.AbsoluteValue>({
    type: "absolute",
    startDate: (new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1)).toISOString().split("T")[0],
    endDate: (new Date()).toISOString().split("T")[0]
  });
  const [preferences, setPreferences] = useState({ pageSize: 10 });
  const { addNotification, removeNotification } = useNotifications();

  const { items, collectionProps, paginationProps } = useCollection(
    [...pages], 
    {
      filtering: {
        empty: (
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No feedback</b>
            </SpaceBetween>
          </Box>
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: {
        defaultState: {
          sortingColumn: {
            sortingField: "time_stamp",
          },
          isDescending: true,
        },
      },
      selection: {},
    }
  );

  const getAllSessions = useCallback(
    async () => {
      setLoading(true);
      let username;
      await Auth.currentAuthenticatedUser().then((value) => username = value.username);
      if (!username) return;  
      try {
        const result = await apiClient.sessions.getAllSessions(value.startDate + "T00:00:00", value.endDate + "T23:59:59", selectedOption.value, hasReviewed.value, username)
        needsRefresh.current = false;
        setPages([...result]);
        setCurrentPageIndex(1);
      } catch (error) {
        console.log(error);
        console.error(Utils.getErrorMessage(error));
        setPages([]);
      }
      setLoading(false);
    },
    [appContext, selectedOption, value, needsRefresh, hasReviewed]
  );

  /** The getAllSessions function is a memoized function.
   * When any of the filters change, getAllSessions will also change and we therefore need a refresh
   */
  useEffect(() => {
    setCurrentPageIndex(1);
    setSelectedItems([]);
    console.log("refresh");
    getAllSessions();
  }, [getAllSessions]);

  /** Handles page refreshes */
  const refreshPage = async () => {
    await getAllSessions();
  };

  const updateSelectedReview = async () => {
    if (!appContext) return;
    setLoading(true);
    let username;
    await Auth.currentAuthenticatedUser().then((value) => username = value.username);
    if (!username) return;
    const apiClient = new ApiClient(appContext);
    await Promise.all(
      selectedItems.map((s) => apiClient.sessions.updateReview(s.review_id, s.session_id, username, true))
    );
    await getAllSessions();
    setSelectedItems([])
    setLoading(false);
  };

  const deleteSelectedReview = async () => {
    if (!appContext) return;
    setLoading(true);
    let username;
    await Auth.currentAuthenticatedUser().then((value) => username = value.username);
    if (!username) return;
    const apiClient = new ApiClient(appContext);
    await Promise.all(
      selectedItems.map((s) => apiClient.sessions.updateReview(s.review_id, s.session_id, username, false))
    );
    await getAllSessions();
    setSelectedItems([])
    setLoading(false);
  };

  const columnDefinitions = getColumnDefinition("session");

  console.log("Pagination props");
  console.log(paginationProps);
  return (
    <>
      <I18nProvider locale="en" messages={[messages]}>


        <Table
          {...collectionProps}
          loading={loading}
          loadingText={`Loading Sessions`}
          columnDefinitions={columnDefinitions}
          selectionType="single"
          onSelectionChange={({ detail }) => {
            props.updateSelectedSession(detail.selectedItems[0])
            setSelectedItems(detail.selectedItems);
          }}
          selectedItems={selectedItems}
          items={items}
          trackBy="session_id"
          resizableColumns
          preferences={
            <CollectionPreferences
              onConfirm={({ detail }) =>
                setPreferences({ pageSize: detail.pageSize ?? 10 })
              }
              title="Preferences"
              confirmLabel="Confirm"
              cancelLabel="Cancel"
              preferences={preferences}
              pageSizePreference={{
                title: "Page size",
                options: [
                  { value: 10, label: "10" },
                  { value: 20, label: "20" },
                  { value: 50, label: "50" },
                ],
              }}
            />
          }
          header={
            <Header
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <DateRangePicker
                    onChange={({ detail }) => {
                      /** If the date changes, refresh all of the feedback. This
                       * prevents bugs where one page is up-to-date and the previous/next ones are not
                       */
                      needsRefresh.current = true;
                      setValue(detail.value as DateRangePickerProps.AbsoluteValue)
                    }}
                    value={value as DateRangePickerProps.AbsoluteValue}
                    relativeOptions={[
                      {
                        key: "previous-5-minutes",
                        amount: 5,
                        unit: "minute",
                        type: "relative"
                      },
                      {
                        key: "previous-30-minutes",
                        amount: 30,
                        unit: "minute",
                        type: "relative"
                      },
                      {
                        key: "previous-1-hour",
                        amount: 1,
                        unit: "hour",
                        type: "relative"
                      },
                      {
                        key: "previous-6-hours",
                        amount: 6,
                        unit: "hour",
                        type: "relative"
                      }
                    ]}

                    isValidRange={range => {
                      if (range.type === "absolute") {
                        const [
                          startDateWithoutTime
                        ] = range.startDate.split("T");
                        const [
                          endDateWithoutTime
                        ] = range.endDate.split("T");
                        if (
                          !startDateWithoutTime ||
                          !endDateWithoutTime
                        ) {
                          return {
                            valid: false,
                            errorMessage:
                              "The selected date range is incomplete. Select a start and end date for the date range."
                          };
                        }
                        if (
                          +new Date(range.startDate) - +new Date(range.endDate) > 0
                        ) {
                          return {
                            valid: false,
                            errorMessage:
                              "The selected date range is invalid. The start date must be before the end date."
                          };
                        }
                      }
                      return { valid: true };
                    }}
                    i18nStrings={{}}
                    placeholder="Filter by a date and time range"
                    showClearButton={false}
                    dateOnly
                    timeInputFormat="hh:mm:ss"
                    rangeSelectorMode="absolute-only"
                  />
                  <Select
                    selectedOption={selectedOption}
                    onChange={({ detail }) => {
                      /** If the feedback status changes, refresh all of the feedback */
                      needsRefresh.current = true;
                      setSelectedOption({ label: detail.selectedOption.label!, value: detail.selectedOption.value });
                    }}
                    placeholder="Select Status"
                    options={[{label : "All Feedback", value: "any", disabled: false}, {label : "Yes", value: "yes", disabled: false}, {label : "No", value: "no", disabled: false}]}
                  />
                  <Select
                    selectedOption={hasReviewed}
                    onChange={({ detail }) => {
                      /** If the review status changes, refresh all of the feedback */
                      needsRefresh.current = true;
                      setHasReviewed({ label: detail.selectedOption.label!, value: detail.selectedOption.value });
                    }}
                    placeholder="Select Status"
                    options={[{label : "All Reviews", value: "any", disabled: false}, {label : "Yes", value: "yes", disabled: false}, {label : "No", value: "no", disabled: false}]}
                  />
                  <Button iconName="refresh" onClick={(event) => refreshPage()} />
                  {/* TODO: No Lambda functionality for downloading session data */}
                  <Button
                    disabled
                    variant="primary"
                    // onClick={() => {
                    //   apiClient.userFeedback.downloadFeedback(selectedOption.value, value.startDate+"T00:00:00", value.endDate+"T23:59:59");
                    //   const id = addNotification("success", "Your files have been downloaded.")
                    //   Utils.delay(3000).then(() => removeNotification(id));
                    // }}
                  >Download All</Button>
                </SpaceBetween>
              }
              description="Please expect a delay for your changes to be reflected. Press the refresh button to see the latest changes."
            >
              {"All Sessions"}

            </Header>
          }
          filter={
            <div>
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button 
                    variant="primary"
                    onClick={() => {
                      console.log("set status to reviewed");
                      console.log(selectedItems);
                      updateSelectedReview();
                    }}
                  >
                    Mark Reviewed
                  </Button>
                    
                  <Button
                    variant="primary"
                    onClick={() => {
                      console.log("set status to unreviewed");
                      console.log(selectedItems);
                      deleteSelectedReview();
                    }}
                  >
                    Mark Unreviewed
                  </Button>
                </SpaceBetween>
              </Box>
            </div>
          }
          empty={
            <Box textAlign="center">No sessions available</Box>
          }
          pagination={<Pagination {...paginationProps} />}
        />
      </I18nProvider>
    </>


  );
}
