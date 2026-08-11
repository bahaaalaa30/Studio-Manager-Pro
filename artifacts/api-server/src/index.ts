import app from "./app";

// Vercel runs the Express app as a serverless function.
// Keep the local listener in a separate entrypoint for local development.
export default app;
