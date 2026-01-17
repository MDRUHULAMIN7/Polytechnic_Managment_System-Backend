
import { Student } from './student.model.js';


const getAllStudentFromDB = async()=>{
    const result = await Student.find();
    return result;
}
const getSingleStudentFromDB = async(id:string)=>{
    const result = await Student.findOne({id});
    return result;
}
const deleteStudentFromDB = async(id:string)=>{
    const result = await Student.deleteOne({id});
    return result;
}

export const studentServices = {
 
  getAllStudentFromDB,
  getSingleStudentFromDB,
  deleteStudentFromDB
};
