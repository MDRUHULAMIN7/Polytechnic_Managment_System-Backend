import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import globalErrorHandeler from './app/middleware/globalErrorHandeler.js';
import notFound from './app/middleware/notFound.js';
import router from './app/routes/index.js';
import cookieParser from 'cookie-parser';
import { corsOptions } from './app/config/cors.js';
import config from './app/config/index.js';
import requestContext from './app/middleware/requestContext.js';
import requestLogger from './app/middleware/requestLogger.js';
import securityHeaders from './app/middleware/securityHeaders.js';
import { createRateLimit } from './app/middleware/rateLimit.js';
const app: Application = express();

//parser
app.set('trust proxy', 1);
app.use(requestContext);
app.use(requestLogger);
app.use(securityHeaders);
app.use(
  createRateLimit({
    name: 'global-api',
    windowMs: config.general_rate_limit_window_ms,
    max: config.general_rate_limit_max,
  }),
);
app.use(express.json({ limit: config.request_body_limit }));
app.use(express.urlencoded({ extended: true, limit: config.request_body_limit }));
app.use(cookieParser());
app.use(cors(corsOptions));
app.options('/{*splat}', cors(corsOptions));

//application routes

// app.use('/api/v1/students', StudentRoutes);

//moved application routes in router folder to organize
app.use('/api/v1', router);

const getAController = (req: Request, res: Response) => {
  res.send('Server is Running ....');
};

app.get('/', getAController);
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Backend is healthy',
  });
});
//global error handeler

app.use(globalErrorHandeler);

//not Found

app.use(notFound);

export default app;
