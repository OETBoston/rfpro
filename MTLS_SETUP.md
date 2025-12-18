# Mutual TLS (mTLS) Configuration Guide

This guide explains how to configure mutual TLS authentication with custom domain names for your API Gateway endpoints.

## Overview

The application now supports mutual TLS (mTLS) authentication for both REST API and WebSocket API endpoints using custom domain names. This provides enhanced security by requiring clients to present valid certificates when connecting to your APIs.

## Prerequisites

Before enabling mTLS, you need:

1. **ACM Certificates**: Valid SSL/TLS certificates in AWS Certificate Manager for your custom domains
2. **Truststore**: A PEM-formatted file containing the trusted Certificate Authorities (CAs) uploaded to S3
3. **Custom Domain Names**: Domain names you own and can configure DNS for

## Environment Variables

### Required for REST API with Custom Domain

```bash
REST_API_CUSTOM_DOMAIN_NAME=api.yourdomain.com
REST_API_CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/xxx
```

### Optional for REST API with mTLS

```bash
REST_API_TRUSTSTORE_URI=s3://your-bucket/path/to/truststore.pem
```

### Required for WebSocket API with Custom Domain

```bash
WS_API_CUSTOM_DOMAIN_NAME=ws.yourdomain.com
WS_API_CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/yyy
```

### Optional for WebSocket API with mTLS

```bash
WS_API_TRUSTSTORE_URI=s3://your-bucket/path/to/ws-truststore.pem
```

## How It Works

1. **Custom Domain Configuration**: When the environment variables for custom domain and certificate ARN are provided, CDK will create a custom domain for your API Gateway

2. **mTLS Configuration**: If a truststore URI is also provided, mTLS will be enabled on the custom domain

3. **Endpoint Selection**: The frontend will automatically use custom domain URLs (if configured) instead of the default AWS-generated API Gateway URLs

4. **Client Certificates**: When mTLS is enabled, clients must present a certificate signed by a CA in your truststore

## Truststore Format

The truststore must be:
- In PEM format
- Contain one or more trusted CA certificates
- Uploaded to S3 with appropriate permissions for API Gateway to read

Example truststore.pem:
```
-----BEGIN CERTIFICATE-----
[Your CA Certificate 1]
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
[Your CA Certificate 2]
-----END CERTIFICATE-----
```

## DNS Configuration

After deploying with custom domains, you need to configure DNS records:

1. Deploy your stack:
   ```bash
   npm run cdk deploy
   ```

2. Find the API Gateway domain targets in the CloudFormation outputs:
   - Look for outputs like "WS-API - CustomDomain" and "HTTP-API - CustomDomain"

3. Create DNS records (CNAME or A/AAAA with alias) pointing your custom domains to the API Gateway endpoints

4. Example Route53 configuration (if using AWS Route53):
   ```typescript
   new route53.CnameRecord(this, 'RestApiDnsRecord', {
     zone: hostedZone,
     recordName: 'api',
     domainName: restApiDomainName.regionalDomainName,
   });
   ```

## Deployment Scenarios

### Scenario 1: Custom Domain without mTLS
Set only the domain name and certificate ARN:
```bash
REST_API_CUSTOM_DOMAIN_NAME=api.yourdomain.com
REST_API_CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/xxx
```
Result: API accessible via custom domain with standard TLS

### Scenario 2: Custom Domain with mTLS
Set domain, certificate, and truststore:
```bash
REST_API_CUSTOM_DOMAIN_NAME=api.yourdomain.com
REST_API_CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/xxx
REST_API_TRUSTSTORE_URI=s3://bucket/truststore.pem
```
Result: API accessible via custom domain, requires client certificates

### Scenario 3: Default AWS Endpoints
Don't set any mTLS environment variables:
Result: Uses default AWS API Gateway endpoints (wss://xxx.execute-api.region.amazonaws.com)

## Client Certificate Requirements (when mTLS is enabled)

Clients connecting to mTLS-enabled APIs must:

1. Have a valid X.509 certificate signed by a CA in your truststore
2. Present the certificate during TLS handshake
3. Use the custom domain name (not the AWS-generated endpoint)

Example with curl:
```bash
curl --cert client-cert.pem --key client-key.pem \
  https://api.yourdomain.com/endpoint
```

Example with WebSocket (JavaScript):
```javascript
// Browser WebSocket with client certificate
// Note: Browser client certificates are managed by the browser/OS
const ws = new WebSocket('wss://ws.yourdomain.com');
```

## Security Compliance Notes

- **Certificate Validation**: API Gateway validates client certificates against the truststore
- **Certificate Rotation**: Update the truststore in S3 to rotate trusted CAs (no version tracking needed)
- **Access Control**: Ensure S3 truststore bucket has appropriate access controls
- **Monitoring**: Monitor CloudWatch logs for authentication failures

## Troubleshooting

### "certificate required" error
- Ensure your truststore is properly formatted (PEM)
- Verify the client certificate is signed by a CA in the truststore
- Check that mTLS is actually enabled (truststore URI is set)

### DNS resolution fails
- Verify DNS records are properly configured
- Check that the custom domain certificate matches the domain name
- Allow time for DNS propagation (can take up to 48 hours)

### Frontend not using custom domain
- Verify environment variables are set before deployment
- Check CloudFormation outputs for custom domain URLs
- Inspect `/aws-exports.json` in your deployed site to confirm endpoints

## Implementation Details

### Architecture

1. **rest-api.ts**: Configures REST API custom domain and mTLS
2. **websocket-api.ts**: Configures WebSocket API custom domain and mTLS
3. **index.ts**: Generates `aws-exports.json` with appropriate endpoints
4. **Frontend**: Loads endpoints from `aws-exports.json` and connects accordingly

### Code Flow

```
Environment Variables
    ↓
CDK Stack (rest-api.ts / websocket-api.ts)
    ↓
Custom Domain + mTLS Configuration
    ↓
aws-exports.json generation (index.ts)
    ↓
Frontend (app-configured.tsx)
    ↓
API Client connections use custom domains
```

## References

- [API Gateway Mutual TLS Authentication](https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-mutual-tls.html)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [API Gateway Custom Domain Names](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)

