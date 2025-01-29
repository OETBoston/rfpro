# Cognito Federated Providers Overview

This folder handles the integration and configuration of Cognito Federated Identity Providers, allowing users to authenticate via external identity systems such as Google, Facebook, or enterprise Single Sign-On (SSO) systems.

## Structure

The configuration files and helper scripts in this folder are organized as follows:

- **/providers**: Contains mappings and configurations for supported identity providers.
- **/custom-rules**: Custom logic for mapping claims and attributes from identity providers to Cognito user pools.
- **/triggers**: Lambda functions associated with Cognito triggers for custom authentication workflows.

## CDK Integration

The CDK stack defines all resources related to Cognito federated authentication. Key components include:

- **Cognito User Pools**: Manages user accounts and provides OAuth 2.0-compliant endpoints for authentication.
- **Cognito Identity Pools**: Allows users to assume AWS roles based on their authentication status.
- **Identity Provider Integration**: Configures external providers using OpenID Connect (OIDC) or SAML.

## Key Features

- **Single Sign-On (SSO)**: Supports enterprise SSO through OIDC and SAML.
- **Customizable User Attributes**: Maps claims from external providers to custom attributes in Cognito.
- **Multi-Factor Authentication (MFA)**: Enhances security by enabling optional or mandatory MFA.

## Deployment Notes

- Federated providers are dynamically registered during deployment to simplify updates and maintenance.
- Lambda triggers are used for advanced workflows, such as custom attribute mapping or post-authentication actions.
- Security is ensured by defining strict scopes and permissions for all integrated providers.

## Troubleshooting Tips

- Verify that external provider credentials are correctly configured in the deployment environment.
- Use CloudWatch logs to trace authentication flows and diagnose errors.