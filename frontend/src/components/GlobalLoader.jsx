import { useState, useEffect } from "react";
import { apiLoadingState } from "../api/axios";
import "./GlobalLoader.scss";

export default function GlobalLoader() {
    const [isLoading, setIsLoading] = useState(apiLoadingState.activeRequests > 0);

    useEffect(() => {
        const unsubscribe = apiLoadingState.subscribe(setIsLoading);
        return () => unsubscribe();
    }, []);

    if (!isLoading) return null;

    return (
        <div className="global-loader-overlay">
            <div className="global-loader-bar">
                <div className="global-loader-progress"></div>
            </div>
        </div>
    );
}
