/* eslint-disable @typescript-eslint/no-unused-vars */
import type { NextFunction, Request, Response } from "express";

const globalErrorHandeler =((err:any,req:Request,res:Response,next:NextFunction)=>{

  const statusCode = 500;
  const message = err.message || 'something went wrong' ;

  return res.status(statusCode).json({
    success:false,
    message,
    error:err
  })

})

export default globalErrorHandeler;