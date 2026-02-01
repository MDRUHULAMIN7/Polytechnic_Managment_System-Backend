/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ErrorRequestHandler, NextFunction } from "express";
import { ZodError } from "zod";

const globalErrorHandeler : ErrorRequestHandler =((err,req,res,next:NextFunction)=>{

  let statusCode = 500;
  let message = err.message || 'something went wrong' ;

  type TErrorSources={
    path:string | number;
    message:string
  }[];
  let errorSources : TErrorSources = [{
    path:'',
    message:"Something went Wrong",
  }]
  
   if(err instanceof ZodError){
    statusCode = 400;
    message = 'ami zod error';
   }
  return res.status(statusCode).json({
    success:false,
    message,
    errorSources,
    error:err,
  })

})

export default globalErrorHandeler;