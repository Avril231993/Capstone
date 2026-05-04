import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coursesRouter from "./courses";
import facultyRouter from "./faculty";
import roomsRouter from "./rooms";
import timeslotsRouter from "./timeslots";
import schedulesRouter from "./schedules";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coursesRouter);
router.use(facultyRouter);
router.use(roomsRouter);
router.use(timeslotsRouter);
router.use(schedulesRouter);
router.use(statsRouter);

export default router;
