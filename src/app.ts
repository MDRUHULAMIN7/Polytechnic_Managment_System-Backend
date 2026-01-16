import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import { StudentRoutes } from './app/modules/student/student.route.js';
import { UserRoutes } from './app/modules/user/user.route.js';
import globalErrorHandeler from './app/middleware/globalErrorHandeler.js';
const app: Application = express();

//parser
app.use(express.json());
app.use(cors());

//application routes

app.use('/api/v1/students', StudentRoutes);
app.use('/api/v1/users', UserRoutes);

const getAController = (req: Request, res: Response) => {
  res.send('Server is Running ....');
};

app.get('/', getAController);

//global error handeler 

app.use(globalErrorHandeler)

export default app;
