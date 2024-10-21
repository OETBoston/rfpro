import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Auth } from 'aws-amplify';

// Define the context type
type AdminContextType = boolean;

// Create the context
const AdminContext = createContext<AdminContextType>(false);

// Define props for the AdminProvider
interface AdminProviderProps {
    children: ReactNode; // Specify children as ReactNode
}

// Create a provider component
export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const result = await Auth.currentAuthenticatedUser();
                if (!result || Object.keys(result).length === 0) {
                    console.log("Signed out!");
                    await Auth.signOut();
                    return;
                }
                console.log("Sign In User Session Payload", result.signInUserSession.idToken.payload["cognito:groups"])
                const userGroups = result.signInUserSession.idToken.payload["cognito:groups"];
                if (userGroups.includes("AdminUsers")) {
                    console.log("Admin found");
                    setIsAdmin(true);
                } else {
                    console.log("Not an admin");
                }
            } catch (error) {
                console.log(error);
            }
        };

        checkAdminStatus();
    }, []);

    return (
        <AdminContext.Provider value= { isAdmin } >
        { children }
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    return useContext(AdminContext);
};