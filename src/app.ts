import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import globalErrorHandeler from './app/middleware/globalErrorHandeler.js';
import notFound from './app/middleware/notFound.js';
import router from './app/routes/index.js';
const app: Application = express();

//parser
app.use(express.json());
app.use(cors());

//application routes

// app.use('/api/v1/students', StudentRoutes);
// app.use('/api/v1/users', UserRoutes);

//moved application routes in router folder to organize 
app.use('/api/v1', router);

const getAController = (req: Request, res: Response) => {
  res.send('Server is Running ....');
};

app.get('/', getAController);

const test = async (req: Request, res: Response) => {
  const a = 10;
  res.send(a);
};

app.get('/',test);
//global error handeler 

app.use(globalErrorHandeler)

//not Found

app.use(notFound)

export default app;
