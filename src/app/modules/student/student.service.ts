
import { Student } from './student.model.js';


const getAllStudentFromDB = async()=>{
    const result = await Student.find();
    return result;
}
const getSingleStudentFromDB = async(id:string)=>{
    const result = await Student.findOne({id});
    return result;
}

export const studentServices = {
 
  getAllStudentFromDB,
  getSingleStudentFromDB,
};
