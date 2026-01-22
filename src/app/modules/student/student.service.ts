
import { Student } from './student.model.js';


const getAllStudentFromDB = async()=>{
    const result = await Student.find().populate({
        path:'academicDepartment',
        populate:{
           path:'academicInstructor',  
        }
    }).populate('admissionSemester');
    return result;
}
const getSingleStudentFromDB = async(id:string)=>{
    const result = await Student.findOne({_id:id}).populate({
        path:'academicDepartment',
        populate:{
           path:'academicInstructor',  
        }
    }).populate('admissionSemester');
    return result;
}
const deleteStudentFromDB = async(id:string)=>{
    const result = await Student.deleteOne({_id:id});
    return result;
}

export const studentServices = {
 
  getAllStudentFromDB,
  getSingleStudentFromDB,
  deleteStudentFromDB
};
