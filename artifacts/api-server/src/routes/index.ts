import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coursesRouter from "./courses";
import facultyRouter from "./faculty";
import roomsRouter from "./rooms";
import timeslotsRouter from "./timeslots";
import schedulesRouter from "./schedules";
import statsRouter from "./stats";
import schoolYearsRouter from "./school-years";
import yearLevelsRouter from "./year-levels";
import loiRouter from "./loi";
import facultySpecializationsRouter from "./faculty-specializations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coursesRouter);
router.use(facultyRouter);
router.use(roomsRouter);
router.use(timeslotsRouter);
router.use(schedulesRouter);
router.use(statsRouter);
router.use(schoolYearsRouter);
router.use(yearLevelsRouter);
router.use(loiRouter);
router.use(facultySpecializationsRouter);

export default router;
