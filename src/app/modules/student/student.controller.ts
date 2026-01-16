import { type Request, type Response } from 'express';
import { studentServices } from './student.service.js';
// import studentJoiValidationSchema from './student.validation.js';


const getAllStudents = async (req: Request, res: Response) => {
  try {
    const result = await studentServices.getAllStudentFromDB();
    res.status(200).json({
      success: true,
      message: 'all student find successfully !',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong !',
      data: error,
    });
  }
};
const getSingleStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;

    const result = await studentServices.getSingleStudentFromDB(studentId);
    res.status(200).json({
      success: true,
      message: 'student find successfully !',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Something went wrong !',
      data: error,
    });
  }
};

export const studentControllers = {

  getAllStudents,
  getSingleStudent,
};
