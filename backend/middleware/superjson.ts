import { Handler } from 'express';
import SuperJSON from 'superjson';
import { anonymizeUsersFor } from '../util/anonymizeUsers';

export const superJsonMiddleware: Handler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    // req.user is only set once passport.authenticate has run for this request, but since this
    // reads it lazily (at response time, not middleware-setup time), it's always populated by
    // the time a route handler actually calls res.json/res.send.
    return json(SuperJSON.serialize(anonymizeUsersFor(body, req.user)));
  };
  next();
};
