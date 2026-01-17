import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

const validateRequest =(schema :ZodTypeAny)=>{


return async( req:Request,res:Response,next:NextFunction)=>{

    try{
         //validation
        //if all ok call naxt 
            await schema.parseAsync({
        body:req.body
    });
    next();
    }catch(err){
        next(err)
    }
   
 

}
}
export default validateRequest