import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Auth } from 'aws-amplify';
import { redirect } from 'react-router-dom';

// Define the context type
type AdminContextType = {
    isAdmin: boolean;
    isLoading: boolean;
};

// Create the context
const AdminContext = createContext<AdminContextType>({ isAdmin: false, isLoading: true });

// Define props for the AdminProvider
interface AdminProviderProps {
    children: ReactNode;
}

// Create a provider component
export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;
        
        const checkAdminStatus = async () => {
            try {
                const result = await Auth.currentAuthenticatedUser();
                if (!result || Object.keys(result).length === 0) {
                    console.log("Signed out!");
                    await Auth.signOut({ global: true });
                    return;
                }
                
                if (!mounted) return;
                
                console.log("Sign In User Session Payload", result.signInUserSession.idToken.payload["cognito:groups"]);
                const userGroups = result.signInUserSession.idToken.payload["cognito:groups"];
                
                if (userGroups.includes("AdminUsers")) {
                    console.log("Elevated Permission for Admin Users");
                    setIsAdmin(true);
                } else if (userGroups.includes("OutsideUsers") && !userGroups.includes("BasicUsers")) {
                    alert("As of Dec 2024, only employees within a designated security group can access Bidbot. Please reach out to Maia Materman (maia.materman@boston.gov) if you need temporary access.");
                    await Auth.signOut({ global: true });
                }
            } catch (error) {
                console.log(error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        checkAdminStatus();
        
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AdminContext.Provider value={{ isAdmin, isLoading }}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    return useContext(AdminContext);
};