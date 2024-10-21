const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');

exports.handler = async (event) => {
    const client = new CognitoIdentityProviderClient();

    const command = new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        GroupName: process.env.BASIC_USER_GROUP_NAME
    });

    try {
        await client.send(command);
        console.log("good")
    } catch (error) {
        console.log(error)
        throw error
    }

    event.response.finalUserStatus = 'CONFIRMED';
    return event
}