import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Alert,
  Container,
  Box,
  ColumnLayout,
  Spinner,
  Button,
  Select,
  BarChart,
  Tabs
} from "@cloudscape-design/components";
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.all';
import useOnFollow from "../../common/hooks/use-on-follow";
import BaseAppLayout from "../../components/base-app-layout";
import { CHATBOT_NAME } from "../../common/constants";
import { useState, useEffect, useContext, useCallback } from "react";
import { Auth } from "aws-amplify";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";

interface MetricsData {
  unique_users: number;
  total_sessions: number;
  total_messages: number;
  daily_breakdown: Array<{
    date: string;
    sessions: number;
    messages: number;
    unique_users: number;
  }>;
}

// Time range presets with their date calculation and grouping strategy
const TIME_RANGE_OPTIONS = [
  { label: "Last 7 days (by day)", value: "7d", days: 7, groupBy: "day" },
  { label: "Last 14 days (by day)", value: "14d", days: 14, groupBy: "day" },
  { label: "Last 30 days (by day)", value: "30d", days: 30, groupBy: "day" },
  { label: "Last 30 days (by week)", value: "30d-week", days: 30, groupBy: "week" },
  { label: "Last 3 months (by week)", value: "3m-week", days: 90, groupBy: "week" },
  { label: "Last 3 months (by month)", value: "3m-month", days: 90, groupBy: "month" },
  { label: "Last 6 months (by week)", value: "6m-week", days: 180, groupBy: "week" },
  { label: "Last 6 months (by month)", value: "6m-month", days: 180, groupBy: "month" },
  { label: "Last 12 months (by month)", value: "12m", days: 365, groupBy: "month" },
  { label: "All time (by month)", value: "all", days: 365 * 3, groupBy: "month" },
];

export default function MetricsPage() {
  const onFollow = useOnFollow();
  const [admin, setAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);

  // Chart state
  const [activeTab, setActiveTab] = useState("summary");
  const [dailyUsersData, setDailyUsersData] = useState<Array<{x: string, y: number}>>([]);
  const [responseTimeData, setResponseTimeData] = useState<Array<{x: string, y: number}>>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGE_OPTIONS[0]); // Default: Last 7 days by day

  /** Checks for admin status */
  useEffect(() => {
    (async () => {
      try {
        const result = await Auth.currentAuthenticatedUser();
        if (!result || Object.keys(result).length === 0) {
          console.log("Signed out!");
          Auth.signOut();
          return;
        }
        const userGroups = result?.signInUserSession?.idToken?.payload["cognito:groups"];
        if (userGroups && userGroups.includes("AdminUsers")) {
          setAdmin(true);
          loadMetrics();
        }
      } catch (e) {
        console.log(e);
      }
    })();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.metrics.getMetrics();
      setMetrics(data);
    } catch (e: any) {
      console.error("Error loading metrics:", e);
      setError(e.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get week key (YYYY-Www format) - used internally for grouping
  const getWeekKey = (dateStr: string) => {
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  // Helper function to convert week key to readable date range (e.g., "Jan 27 - Feb 2")
  const weekKeyToDateRange = (weekKey: string): string => {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    
    // Calculate the first day of the week (Monday)
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (week - 1) * 7 - jan1.getDay() + 1; // Adjust for day of week
    const weekStart = new Date(year, 0, 1 + daysOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startMonth = months[weekStart.getMonth()];
    const startDay = weekStart.getDate();
    const endMonth = months[weekEnd.getMonth()];
    const endDay = weekEnd.getDate();
    
    // If same month, show "Jan 27 - 31", otherwise "Jan 27 - Feb 2"
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  // Helper function to get month key (YYYY-MM format)
  const getMonthKey = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Helper function to get grouping key based on groupBy type
  const getGroupKey = (dateStr: string, groupBy: string) => {
    switch (groupBy) {
      case 'week':
        return getWeekKey(dateStr);
      case 'month':
        return getMonthKey(dateStr);
      default:
        return dateStr.split('T')[0]; // Day
    }
  };

  // Calculate date range based on selected preset
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - selectedTimeRange.days);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  // Generate all period keys for the date range (to show empty bars)
  const generateAllPeriodKeys = (startDateStr: string, endDateStr: string, groupBy: string): string[] => {
    const keys: string[] = [];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    if (groupBy === 'day') {
      // Generate all days
      const current = new Date(startDate);
      while (current <= endDate) {
        keys.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    } else if (groupBy === 'week') {
      // Generate all weeks
      const current = new Date(startDate);
      const seenWeeks = new Set<string>();
      while (current <= endDate) {
        const weekKey = getWeekKey(current.toISOString());
        if (!seenWeeks.has(weekKey)) {
          seenWeeks.add(weekKey);
          keys.push(weekKey);
        }
        current.setDate(current.getDate() + 7);
      }
      // Add final week if not included
      const endWeekKey = getWeekKey(endDate.toISOString());
      if (!seenWeeks.has(endWeekKey)) {
        keys.push(endWeekKey);
      }
    } else if (groupBy === 'month') {
      // Generate all months
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current <= endDate) {
        const monthKey = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
        keys.push(monthKey);
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    return keys.sort();
  };

  const loadChartData = useCallback(async () => {
    if (!appContext) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const groupBy = selectedTimeRange.groupBy;

      // Generate all period keys for the range
      const allPeriodKeys = generateAllPeriodKeys(startDate, endDate, groupBy);

      // Get daily logins data
      const dailyLogins = await apiClient.metrics.getDailyLogins(
        startDate.split("T")[0], 
        endDate.split("T")[0]
      );
      
      // Get interaction data for response times
      const interactions = await apiClient.metrics.getChatbotUse(startDate, endDate);
      const items = interactions?.Items || [];

      // Initialize all periods with 0
      const usersGrouped: Record<string, number> = {};
      const responseTimeGrouped: Record<string, { sum: number, count: number }> = {};
      
      for (const key of allPeriodKeys) {
        usersGrouped[key] = 0;
        responseTimeGrouped[key] = { sum: 0, count: 0 };
      }

      // Aggregate daily users
      for (const item of dailyLogins) {
        const key = getGroupKey(item.x, groupBy);
        if (usersGrouped[key] !== undefined) {
          usersGrouped[key] = (usersGrouped[key] || 0) + item.y;
        }
      }

      // Aggregate response times (skip 0 values as they are N/A)
      for (const item of items) {
        const responseTime = item.ResponseTime;
        // Skip response time 0 as N/A (no data)
        if (responseTime === 0 || responseTime === null || responseTime === undefined) {
          continue;
        }
        const key = getGroupKey(item.Timestamp, groupBy);
        if (responseTimeGrouped[key]) {
          responseTimeGrouped[key].sum += responseTime;
          responseTimeGrouped[key].count += 1;
        }
      }

      // Helper to format keys for display
      const formatKeyForDisplay = (key: string): string => {
        if (groupBy === 'week') {
          return weekKeyToDateRange(key);
        }
        return key;
      };

      // Convert to chart data format (already sorted since allPeriodKeys is sorted)
      const usersChartData = allPeriodKeys.map(key => ({ 
        x: formatKeyForDisplay(key), 
        y: usersGrouped[key] 
      }));

      const responseTimeChartData = allPeriodKeys.map(key => {
        const data = responseTimeGrouped[key];
        // Show 0 for periods with no response time data (will display as empty bar)
        const avgTime = data.count > 0 
          ? Math.round((data.sum / data.count) * 100) / 100 
          : 0;
        return { x: formatKeyForDisplay(key), y: avgTime };
      });

      setDailyUsersData(usersChartData);
      setResponseTimeData(responseTimeChartData);
    } catch (e) {
      console.error("Error loading chart data:", e);
      setDailyUsersData([]);
      setResponseTimeData([]);
    }
    setLoading(false);
  }, [appContext, selectedTimeRange, apiClient]);

  useEffect(() => {
    if (activeTab === "charts" && admin) {
      loadChartData();
    }
  }, [activeTab, admin, selectedTimeRange]);

  const refreshPage = async () => {
    if (activeTab === "summary") {
      await loadMetrics();
    } else {
      await loadChartData();
    }
  };

  // Get x-axis title based on groupBy
  const getXAxisTitle = () => {
    switch (selectedTimeRange.groupBy) {
      case 'week': return 'Week';
      case 'month': return 'Month';
      default: return 'Date';
    }
  };

  /** If the admin status check fails, show access denied page */
  if (!admin) {
    return (
      <div
        style={{
          height: "90vh",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Alert header="Configuration error" type="error">
          You are not authorized to view this page!
        </Alert>
      </div>
    );
  }

  return (
    <BaseAppLayout
      contentType="cards"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Metrics",
              href: "/admin/metrics",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              actions={
                <Button onClick={refreshPage} disabled={loading} iconName="refresh">
                  Refresh
                </Button>
              }
            >
              Metrics Dashboard
            </Header>
          }
        >
          <Tabs
            activeTabId={activeTab}
            onChange={({ detail }) => setActiveTab(detail.activeTabId)}
            tabs={[
              {
                id: "summary",
                label: "Summary",
                content: (
                  <SpaceBetween size="l">
                    {loading && (
                      <Box textAlign="center" padding="xl">
                        <Spinner />
                      </Box>
                    )}

                    {error && (
                      <Alert type="error" dismissible onDismiss={() => setError(null)}>
                        {error}
                      </Alert>
                    )}

                    {metrics && !loading && (
                      <>
                        <ColumnLayout columns={3}>
                          <Container header={<Header variant="h2">Total Users</Header>}>
                            <Box fontSize="display-l" fontWeight="bold" textAlign="center" padding="xl">
                              {metrics.unique_users.toLocaleString()}
                            </Box>
                          </Container>
                          <Container header={<Header variant="h2">Total Sessions</Header>}>
                            <Box fontSize="display-l" fontWeight="bold" textAlign="center" padding="xl">
                              {metrics.total_sessions.toLocaleString()}
                            </Box>
                          </Container>
                          <Container header={<Header variant="h2">Total Messages</Header>}>
                            <Box fontSize="display-l" fontWeight="bold" textAlign="center" padding="xl">
                              {metrics.total_messages.toLocaleString()}
                            </Box>
                          </Container>
                        </ColumnLayout>

                        <Container header={<Header variant="h2">Daily Breakdown</Header>}>
                          <SpaceBetween size="s">
                            {metrics.daily_breakdown.length === 0 ? (
                              <Box textAlign="center" padding="l">
                                No data available
                              </Box>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "2px solid #e9ebed" }}>
                                    <th style={{ textAlign: "left", padding: "12px", fontWeight: "bold" }}>Date</th>
                                    <th style={{ textAlign: "right", padding: "12px", fontWeight: "bold" }}>Sessions</th>
                                    <th style={{ textAlign: "right", padding: "12px", fontWeight: "bold" }}>Messages</th>
                                    <th style={{ textAlign: "right", padding: "12px", fontWeight: "bold" }}>Unique Users</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {metrics.daily_breakdown.map((day, index) => (
                                    <tr key={day.date} style={{ borderBottom: index < metrics.daily_breakdown.length - 1 ? "1px solid #e9ebed" : "none" }}>
                                      <td style={{ padding: "12px" }}>{day.date}</td>
                                      <td style={{ textAlign: "right", padding: "12px" }}>
                                        {day.sessions.toLocaleString()}
                                      </td>
                                      <td style={{ textAlign: "right", padding: "12px" }}>
                                        {day.messages.toLocaleString()}
                                      </td>
                                      <td style={{ textAlign: "right", padding: "12px" }}>
                                        {day.unique_users.toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </SpaceBetween>
                        </Container>
                      </>
                    )}
                  </SpaceBetween>
                )
              },
              {
                id: "charts",
                label: "Charts",
                content: (
                  <I18nProvider locale="en" messages={[messages]}>
                    <SpaceBetween size="l">
                      <Header
                        actions={
                          <SpaceBetween direction="horizontal" size="xs">
                            <Select
                              selectedOption={selectedTimeRange}
                              onChange={({ detail }) => {
                                const option = TIME_RANGE_OPTIONS.find(o => o.value === detail.selectedOption.value);
                                if (option) {
                                  setSelectedTimeRange(option);
                                }
                              }}
                              options={TIME_RANGE_OPTIONS}
                            />
                            <Button iconName="refresh" onClick={refreshPage} aria-label="Refresh charts"/>
                          </SpaceBetween>
                        }
                        description={`Showing ${selectedTimeRange.label.toLowerCase()}`}
                      >
                        Usage Charts
                      </Header>

                      {loading && (
                        <Box textAlign="center" padding="xl">
                          <Spinner />
                        </Box>
                      )}

                      {!loading && (
                        <ColumnLayout columns={Math.max(dailyUsersData.length, responseTimeData.length) > 12 ? 1 : 2}>
                          <Container header={<Header variant="h2">Users</Header>}>
                            <BarChart
                              series={dailyUsersData.length > 0 ? [{
                                title: "Users",
                                type: "bar",
                                data: dailyUsersData
                              }] : []}
                              xTitle={getXAxisTitle()}
                              yTitle="Users"
                              ariaLabel="Bar chart of users over time"
                              height={300}
                              hideFilter
                              empty={
                                <Box textAlign="center" color="inherit">
                                  <b>No data available</b>
                                  <Box variant="p" color="inherit">
                                    There is no data available in the selected timeframe
                                  </Box>
                                </Box>
                              }
                            />
                          </Container>

                          <Container header={<Header variant="h2">Average Response Time</Header>}>
                            <BarChart
                              series={responseTimeData.length > 0 ? [{
                                title: "Avg Response Time",
                                type: "bar",
                                data: responseTimeData,
                                valueFormatter: (value) => `${value}s`
                              }] : []}
                              xTitle={getXAxisTitle()}
                              yTitle="Seconds"
                              ariaLabel="Bar chart of average response time over time"
                              height={300}
                              hideFilter
                              i18nStrings={{
                                yTickFormatter: (value) => `${value}s`
                              }}
                              empty={
                                <Box textAlign="center" color="inherit">
                                  <b>No data available</b>
                                  <Box variant="p" color="inherit">
                                    Response time data is not available (N/A) for the selected timeframe
                                  </Box>
                                </Box>
                              }
                            />
                          </Container>
                        </ColumnLayout>
                      )}
                    </SpaceBetween>
                  </I18nProvider>
                )
              }
            ]}
          />
        </ContentLayout>
      }
    />
  );
}
