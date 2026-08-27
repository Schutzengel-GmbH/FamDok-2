import '../shared/sharedGlobals';
import express from 'express';
import cors from 'cors';
import FamilyRouter from './routes/familyRouter';
import CaseFormRouter from './routes/caseFormRouter';
import CaseFormResponseRouter from './routes/caseFormResponseRouter';
import UserRouter from './routes/userRouter';
import { MeRouter } from './routes/meRouter';
import { OrgRouter } from './routes/orgRouter';
import CaseRouter from './routes/caseRouter';
import GeneralFormRouter from './routes/generalFormRouter';
import passport from 'passport';
import { bearerStrategy } from './middleware/passport';
import { FRONTEND_BASE_URL } from './config';
import { superJsonMiddleware } from './middleware/superjson';
import { StatsRouter } from './routes/statsRouter';
import { SettingsRouter } from './routes/settingsRouter';
import { WarningsRouter } from './routes/warningsRouter';
import DocumentRouter from './routes/documentRouter';
import { startPersonalDataRetentionJob } from './util/personalDataRetentionJob';

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: FRONTEND_BASE_URL,
  })
);

app.use(express.json());
app.use(superJsonMiddleware);

passport.use(bearerStrategy);

app.use(
  '/family',
  passport.authenticate('bearer', { session: false }),
  FamilyRouter
);
app.use(
  '/case-form-definition',
  passport.authenticate('bearer', { session: false }),
  CaseFormRouter
);
app.use(
  '/case-form-response',
  passport.authenticate('bearer', { session: false }),
  CaseFormResponseRouter
);
app.use(
  '/user',
  passport.authenticate('bearer', { session: false }),
  UserRouter
);
app.use('/me', passport.authenticate('bearer', { session: false }), MeRouter);
app.use('/org', passport.authenticate('bearer', { session: false }), OrgRouter);
app.use(
  '/case',
  passport.authenticate('bearer', { session: false }),
  CaseRouter
);
app.use(
  '/general-form',
  passport.authenticate('bearer', { session: false }),
  GeneralFormRouter
);
app.use(
  '/stats',
  passport.authenticate('bearer', { session: false }),
  StatsRouter
);
app.use(
  '/settings',
  passport.authenticate('bearer', { session: false }),
  SettingsRouter
);
app.use(
  '/warnings',
  passport.authenticate('bearer', { session: false }),
  WarningsRouter
);
app.use(
  '/document',
  passport.authenticate('bearer', { session: false }),
  DocumentRouter
);

startPersonalDataRetentionJob();

app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
