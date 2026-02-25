import { createContext, useState, useContext } from "react";

export const LoadingContext = createContext();

export function LoadingProvider({ children }) {
    const [globalLoading, setGlobalLoading] = useState(false);

    return (
        <LoadingContext.Provider value={{ globalLoading, setGlobalLoading }}>
            {children}
        </LoadingContext.Provider>
    );
}

export const useLoading = () => useContext(LoadingContext);
