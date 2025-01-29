import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

export const handler = async (event) => {
    console.log("Post Authentication Lambda Triggered")
    const client = new CognitoIdentityProviderClient();
    console.log(event)
    try {
        // Extract the custom:isMemberOf attribute and parse it as JSON
        const isApprovedUser = JSON.parse(event.request.userAttributes['custom:isMemberOf']).includes("SG_AB_BIDBOT");
        console.log("Has Security Group? ", isApprovedUser)
        // Proceed to add the user to the default group
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: isApprovedUser ? process.env.BASIC_USER_GROUP_NAME : process.env.OUTSIDE_USER_GROUP_NAME
        });
        await client.send(command);
        console.log("User added to group successfully.");

    } catch (error) {
        console.log("Error: ", error)
        const command = new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: process.env.OUTSIDE_USER_GROUP_NAME
        });
        await client.send(command);
        console.log("User added to group successfully.");
    }

    event.response.finalUserStatus = 'CONFIRMED';
    return event;
};