import type { Response } from "express";

type TResponse<T>={
statusCode:number,
    success:boolean,
    message?:string,
       meta?:TMeta,
    data:T
}
type TMeta = {
  limit: number;
  page: number;
  total: number;
  
  totalPage: number;
};
const sendResponse= <T>(res:Response,data:TResponse<T>)=>{

    res.status(data.statusCode).json({
        success:data.success,
        message:data.message,
         meta: data.meta,
        data:data.data
    })
}

export default sendResponse