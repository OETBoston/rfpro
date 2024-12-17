import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

export const handler = async (event) => {
    const client = new CognitoIdentityProviderClient();

    try {
        // Extract the custom:isMemberOf attribute and parse it as JSON
        const isApprovedUser = JSON.parse(event.request.userAttributes['custom:isMemberOf']).includes("SG_AB_BIDBOT");

        // Proceed to add the user to the default group
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: isApprovedUser ? process.env.BASIC_USER_GROUP_NAME : process.env.OUTSIDE_USER_GROUP_NAME
        });
        
        await client.send(command);
        console.log("User added to group successfully.");

    } catch (error) {
        console.error("Error: ", error.message);
        throw error;
    }

    event.response.finalUserStatus = 'CONFIRMED';
    return event;
};