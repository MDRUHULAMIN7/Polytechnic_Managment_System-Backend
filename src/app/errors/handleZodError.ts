import type { ZodError } from "zod";
import type { TErrorSource } from "../../interface/error.js";

 const handleZodError = (err: ZodError) => {
    const errorSources: TErrorSource[] = err.issues.map((issue) => ({
      path:  String(issue.path[issue.path.length - 1] ?? ""),
      message: issue.message,
    }));

    return {
      statusCode: 400,
      message: "Validation Error",
      errorSources,
    };
  };
  export default handleZodError;