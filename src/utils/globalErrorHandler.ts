const handleGlobalError = (error: any) => {
    switch (error.code) {
        case "ECONNREFUSED":
            error("Connection refused");
            break;
        case "ENOTFOUND":
            error("Host not found");
            break;
        case "ETIMEDOUT":
            error("Connection timed out");
            break;
        default:
            error("Unhandled error:", error);
    }
};

export function setupGlobalErrorHandlers(): void {
    process.on("unhandledRejection", handleGlobalError);
    process.on("uncaughtException", handleGlobalError);
}