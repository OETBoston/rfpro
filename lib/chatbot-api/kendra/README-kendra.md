# Kendra Overview

This folder contains the configuration files and data mappings for Amazon Kendra, an intelligent search service used to enable advanced search functionality within the application.

## Structure

The Kendra setup is organized as follows:

- **/data-sources**: Configurations for connecting to external data sources like S3 buckets, DynamoDB tables, and RDS instances.
- **/indexes**: Definitions of Kendra indexes, including field mappings and metadata settings.
- **/query-suggestions**: Custom configurations for query auto-completion and suggestions.

## CDK Integration

The AWS CDK manages all Kendra resources, simplifying their deployment and configuration. Key components include:

- **Indexes**: Centralized storage for searchable data, with customizable relevance tuning.
- **Data Source Connectors**: Automatically syncs data from various AWS and third-party services.
- **Access Policies**: Configures fine-grained access controls to ensure data security.

## Key Features

- **Natural Language Processing (NLP)**: Supports queries in natural language, making search more intuitive for users.
- **Custom Relevance Tuning**: Allows fine-tuning of search results to prioritize certain data fields or sources.
- **Multilingual Support**: Processes and understands queries in multiple languages.
- **Incremental Data Syncing**: Periodically syncs only the changes from data sources, improving efficiency.

## Deployment Notes

- Ensure that all data sources are properly indexed before enabling search functionality.
- Relevance tuning is an iterative process; update configurations based on user feedback.
- Indexes are updated asynchronously, so allow sufficient time for changes to propagate.

## Troubleshooting Tips

- Verify data source connectivity and permissions if indexing fails.
- Check query logs in CloudWatch for insights into search performance and user behavior.
- Test search queries across various scenarios to ensure accuracy and relevance.