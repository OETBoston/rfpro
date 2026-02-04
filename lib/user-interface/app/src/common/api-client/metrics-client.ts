import {
  Utils
} from "../utils"
import { AppConfig } from "../types"; 

export class MetricClient {
  private readonly API: string;
  constructor(protected _appConfig: AppConfig) {
    this.API = _appConfig.httpEndpoint.replace(/\/$/, '');
  }

  /**
   * Get chatbot interaction data within a time range.
   * Used for response time aggregation.
   */
  async getChatbotUse(startTime?: string, endTime?: string, nextPageToken?: string) {
    try {
      const auth = await Utils.authenticate();
      const params = new URLSearchParams();
      if (startTime) params.append("startTime", startTime);
      if (endTime) params.append("endTime", endTime);
      if (nextPageToken) params.append("nextPageToken", nextPageToken);
    
      const response = await fetch(this.API + '/chatbot-use?' + params.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
        },        
      });
      return await response.json();
    } catch (e) {
      console.log("Error retrieving chatbot use data - " + e);
      return { Items: [] };
    }
  }

  /**
   * Get daily login counts within a date range.
   * Returns data formatted for BarChart.
   */
  async getDailyLogins(startDate?: string, endDate?: string) {
    try {
      const auth = await Utils.authenticate();
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const url = `${this.API}/daily-logins?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
        },        
      });
      const data = await response.json();
      // Return data formatted for BarChart
      const chartData = data['logins'].map((item) => ({
        x: item['Timestamp'], 
        y: parseInt(item['Count'])
      }));
    
      return chartData;
    } catch (e) {
      console.log("Error retrieving daily logins - " + e);
      return [];
    }
  }

  /**
   * Get overall metrics summary (total users, sessions, messages).
   */
  async getMetrics() {
    try {
      const auth = await Utils.authenticate();
      const response = await fetch(this.API + '/metrics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err) {
      console.log("Error retrieving metrics:", err);
      throw err;
    }
  }
}
