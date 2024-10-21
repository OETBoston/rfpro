#!/bin/bash
source $PWD/.env

echo $"\n[INFO] Validating Configuration Data..."\

# Validate AWS CLI profile
validate_aws_profile() {
    local profile=$1
    if ! aws sts get-caller-identity --profile "$profile" --no-verify-ssl > /dev/null 2>&1; then
        error_list+=("\n[ERROR] AWS_PROFILE '$profile' does not exist or is not properly configured.")
        error_list+=("\n[ERROR] Try running [ aws sts get-caller-identity --profile '$profile' ]for specifics.")
        error_list+=("\n[INFO] You must declare the value of AWS_PROFILE in the .env file at the project root to proceed. Reference .env.example for details.")
    else
        echo "\n[SUCCESS] Preconfigured AWS_PROFILE '$profile' will be used for deployment."
    fi
}

# Function to check if the system prompt text file exists and is not empty
check_system_prompt_text_file() {
    if [ ! -f 'system-prompt.txt' ]; then
        error_list+=("\n[ERROR] File 'system-prompt.txt' is missing.")
        error_list+=("\n[INFO] You must create a 'system-prompt.txt' at the project root to proceed. It includes the default system prompt for the rag tool.")
    elif [ ! -s "system-prompt.txt" ]; then
        error_list+=("\nFile 'system-prompt.txt' is empty.")
        error_list+=("\n[INFO] You must edit the contents of 'system-prompt.txt' at the project root to proceed. It includes the default system prompt for the rag tool.")
    else
        # Display the contents of the file
        printf '%.0s-' {1..100}
        echo $"\n[INFO] Please Confirm the Configured System Prompt Below:\n"
        echo $"\n"
        cat "system-prompt.txt"
        echo $"\n"
        printf '%.0s-' {1..100}
        # Prompt the user to confirm
        read -rep $'\n'"[ACTION] Do you confirm deployment with the above details? (Y/n): " confirmation
        # Checks validation
        if [ "$confirmation" != "y" ] && [ "$confirmation" != "" ]; then
            echo "\n[ACTION] Deployment process terminated by user."
            exit 1
        fi
        echo $"\n[SUCCESS] The above system prompt will be used for deployment."
    fi
}

# Function to check if a variable is empty
check_var() {
    local var_name=$1
    local var_value=$2
    local is_optional=$3
    local is_critical=$4

    # Use indirect reference to modify the arrays
    if [ -z "$var_value" ]; then
        if [ "$is_optional" == "true" ]; then
            warning_list+=("OPTIONAL environment variable $var_name is not set or empty.")
            if  [ "$is_critical" == "true" ]; then
                echo "\n[WARNING] CRITICAL environment variable $var_name is not set or empty"
                echo '\n[INFO] This variable should only be missing if the cloudfront domain is unknown before initialization.'
                read -rep $'\n'"[ACTION] Is this an INITIAL deployment? (y/n): " confirmation
                # Checks validation
                if [ "$confirmation" != "y" ] && [ "$confirmation" != "" ]; then
                    echo "\n[ACTION] Please set $var_name with cloudfront hosted domain name."
                    exit 1
                fi
            fi
        else
            error_list+=("Environment variable $var_name is not set or empty.")
            error_list+=("[INFO] You must declare the value of these variables in the .env file at the project root to proceed. Reference .env.example for details.")
        fi
    fi
}

# Validate environment variables

# Lists to store errors and warnings
error_list=()
warning_list=()

# Validate AWS profile
echo "\n[INFO] Validating AWS_PROFILE in .env..."
validate_aws_profile $AWS_PROFILE

# Validate System Prompt Text File
echo "\n[INFO] Validating system-prompt.txt..."
check_system_prompt_text_file

# Check environment variables
echo "\n[INFO] Validating Remaining Environment Variables..."
check_var "CDK_DEFAULT_ACCOUNT" "$CDK_DEFAULT_ACCOUNT" "false" "false"
check_var "CDK_DEFAULT_REGION" "$CDK_DEFAULT_REGION" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_NAME" "$COGNITO_OIDC_PROVIDER_NAME" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_CLIENT_ID" "$COGNITO_OIDC_PROVIDER_CLIENT_ID" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_CLIENT_SECRET" "$COGNITO_OIDC_PROVIDER_CLIENT_SECRET" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_ISSUER_URL" "$COGNITO_OIDC_PROVIDER_ISSUER_URL" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_AUTHORIZATION_ENDPOINT" "$COGNITO_OIDC_PROVIDER_AUTHORIZATION_ENDPOINT" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_JWKS_URI" "$COGNITO_OIDC_PROVIDER_JWKS_URI" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_TOKEN_ENDPOINT" "$COGNITO_OIDC_PROVIDER_TOKEN_ENDPOINT" "false" "false"
check_var "COGNITO_OIDC_PROVIDER_USER_INFO_ENDPOINT" "$COGNITO_OIDC_PROVIDER_USER_INFO_ENDPOINT" "false" "false"
check_var "CDK_STACK_NAME" "$CDK_STACK_NAME" "false" "false"
check_var "KENDRA_INDEX_NAME" "$KENDRA_INDEX_NAME" "false" "false"
check_var "COGNITO_DOMAIN_PREFIX" "$COGNITO_DOMAIN_PREFIX" "false" "false"
# Optional variable
check_var "COGNITO_USER_POOL_CLIENT_LOGOUT_URL" "$COGNITO_USER_POOL_CLIENT_LOGOUT_URL" "true" "false"

# Output errors and warnings
if [ ${#error_list[@]} -gt 0 ]; then
    echo "\n[ERROR]:"
    for error in "${error_list[@]}"; do
        echo "\t$error"
    done
    exit 1
fi

if [ ${#warning_list[@]} -gt 0 ]; then
    echo "\n[WARNING]:"
    for warning in "${warning_list[@]}"; do
        echo "\t$warning"
    done
fi

echo "\n[INFO] Validation Passed! Proceding to Redeployment...\n"